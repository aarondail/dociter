import { Document, Node, Span } from "../document-model";
import { FlowDirection } from "../shared-utils";
import { CursorNavigator, CursorOrientation, NodeNavigator, PseudoNode, ReadonlyCursorNavigator } from "../traversal";
import { AnchorPullDirection } from "../working-document";

import { JoinType, joinInto } from "./joinCommands";
import { TargetPayload } from "./payloads";
import { coreCommand } from "./types";
import { CommandUtils, SelectTargetsSort } from "./utils";

interface DeleteOptions {
  /**
   * By default when an interactor is positioned somewhere where the next node
   * to delete has a different parent node (e.g., the interactor is positioned
   * before the first grapheme in an `InlineText`), the deletion is a no-op. If
   * this is set to true, no deletion will happen but the interactor will be
   * moved to the next logical cursor position. Note that for cross InlineText
   * cases, `allowAdjacentInlineTextDeletion`  takes precedence over this.
   */
  readonly allowMovementInBoundaryCases: boolean;
  /**
   * In cases where the cursor is at the edge of a block, deletion can be made
   * to instead behave like a joining operation.
   */
  readonly allowJoiningBlocksInBoundaryCases: boolean;
  readonly allowNodeTypeCoercionWhenJoiningBlocks: boolean;
  readonly direction: FlowDirection;
}

export type DeletePayload = TargetPayload & Partial<DeleteOptions>;

export const deleteImplementation = coreCommand<DeletePayload>("delete", (state, services, payload) => {
  const options: DeleteOptions = {
    allowMovementInBoundaryCases: payload.allowMovementInBoundaryCases ?? false,
    allowJoiningBlocksInBoundaryCases: payload.allowJoiningBlocksInBoundaryCases ?? false,
    allowNodeTypeCoercionWhenJoiningBlocks: payload.allowNodeTypeCoercionWhenJoiningBlocks ?? false,
    direction: payload.direction ?? FlowDirection.Backward,
  };

  const targets = CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Reversed);

  for (const target of targets) {
    if (target.selectionRange) {
      state.deleteRange(
        target.selectionRange,
        target.isMainCursorFirst ? AnchorPullDirection.Backward : AnchorPullDirection.Forward
      );
      // Clear selection
      state.updateInteractor(target.interactor.id, { selectionAnchor: undefined });
    } else {
      const { interactor, mainAnchorNavigator } = target;

      const result = findNodeRelativeToCursorForDeletion(mainAnchorNavigator, options);
      if (result?.nodeToDelete) {
        // Don't try to delete the document node
        if ((result.nodeToDelete.tip.node as Node)?.nodeType === Document) {
          continue;
        }
        // Individual node deletion
        state.deleteAtPath(
          result.nodeToDelete.path,
          options.direction === FlowDirection.Backward ? AnchorPullDirection.Backward : AnchorPullDirection.Forward
        );
      } else if (result?.justMoveTo) {
        // Just move the anchor/interactor
        state.updateInteractor(interactor.id, {
          mainAnchor: state.getAnchorParametersFromCursorNavigator(result.justMoveTo),
        });
      } else if (result?.joinInstead) {
        // Join instead of delete
        services.execute(
          joinInto({
            type: JoinType.Blocks,
            target: { interactorId: interactor.id },
            direction: options.direction,
            allowNodeTypeCoercion: payload.allowNodeTypeCoercionWhenJoiningBlocks,
          })
        );
      }
    }
  }
});

/**
 * This function identifies the proper node to delete based on the passed in
 * navigator, which comes from an interactor's `mainCursor`.
 *
 * Depending on the passed in `DeleteOptions` instead of a deletion sometimes
 * movement can occur. In this case a CursorNavigator representing the new
 * position for the interactor is returned.
 *
 * Also undefined can be returned, indicating there is nothing to delete and the
 * interactor does not need to be moved.
 */
function findNodeRelativeToCursorForDeletion(
  navigator: ReadonlyCursorNavigator,
  options: DeleteOptions
):
  | { readonly justMoveTo?: CursorNavigator; readonly nodeToDelete?: NodeNavigator; readonly joinInstead?: boolean }
  | undefined {
  const isBack = options.direction === FlowDirection.Backward;
  const nodeToDelete = navigator.toNodeNavigator();
  const orientation = navigator.cursor.orientation;

  const currentNode = navigator.tip.node;
  if (PseudoNode.isGrapheme(currentNode)) {
    const parentAndTip = navigator.chain.getParentAndTipIfPossible();
    if (!parentAndTip) {
      return undefined;
    }
    const [parent, tip] = parentAndTip;

    if (!CommandUtils.doesNodeTypeHaveTextOrFancyText((parent.node as Node).nodeType)) {
      return undefined;
    }

    let index = tip.pathPart?.index || 0;
    if (isBack) {
      if (orientation === CursorOrientation.Before) {
        index--;
      }
    } else {
      if (orientation === CursorOrientation.After) {
        index++;
        nodeToDelete.navigateToNextSibling();
      }
    }

    // Are we at the edge of the text containing Node
    if ((isBack && index === -1) || (!isBack && index === (parent.node as Node).children?.length)) {
      const navPrime = navigator.clone();
      const parentHasPrecedingOrFollowingSibling =
        navPrime.navigateFreelyToParent() &&
        (isBack ? navPrime.navigateFreelyToPrecedingSibling() : navPrime.navigateFreelyToNextSibling());

      // In the code here, we just handle the case where we are deleting
      // backwards (or forwards) from one InlineText to another inside the
      // same block (e.g. ParagraphBlock)
      if (
        (parent.node as Node).nodeType === Span &&
        parentHasPrecedingOrFollowingSibling &&
        (navPrime.tip.node as Node).nodeType === Span
      ) {
        isBack ? navPrime.navigateToLastDescendantCursorPosition() : navPrime.navigateToFirstDescendantCursorPosition();
        if (isBack && navPrime.cursor.orientation === CursorOrientation.Before) {
          navPrime.changeCursorOrientationFreely(CursorOrientation.After);
        } else if (!isBack && navPrime.cursor.orientation === CursorOrientation.After) {
          navPrime.changeCursorOrientationFreely(CursorOrientation.Before);
        }
        return findNodeRelativeToCursorForDeletion(navPrime, options);
      }

      // Joining logic should probably be added here in the future
      if (options.allowJoiningBlocksInBoundaryCases) {
        return { joinInstead: true };
      }

      // Fall through to movement logic (which sometimes but not always is
      // applied) below...
    } else {
      // TODO we should join spans too...
      if ((parent.node as Node).nodeType === Span && (parent.node as Node).children.length === 1) {
        // In this case we are about to remove the last character in an
        // inline text In this case, we prefer to delete the inline text.
        const navPrime = navigator.toNodeNavigator();
        navPrime.navigateToParent();
        return { nodeToDelete: navPrime };
      } else {
        // In this case, the nodeToDelete is already on the right node
        return { nodeToDelete };
      }
    }
  } else if (orientation === CursorOrientation.On) {
    return { nodeToDelete };
  }

  // Non-deletion potential movement logic
  if (options.allowMovementInBoundaryCases) {
    const navPrime = navigator.clone();
    isBack ? navPrime.navigateToPrecedingCursorPosition() : navPrime.navigateToNextCursorPosition();
    return { justMoveTo: navPrime };
  }
  return undefined;
}
