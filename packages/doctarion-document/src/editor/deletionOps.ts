import lodash from "lodash";

import { NodeNavigator } from "../basic-traversal";
import { CursorNavigator, CursorOrientation, ReadonlyCursorNavigator } from "../cursor";
import { InlineEmoji, InlineText, NodeUtils } from "../models";
import { FlowDirection } from "../working-document";

import { joinBlocks } from "./joinOps";
import { createCoreOperation } from "./operation";
import { TargetPayload } from "./payloads";
import { getRangeForSelection, selectTargets } from "./utils";

interface DeleteOptions {
  /**
   * By default when an interactor is positioned around
   * an InlineEmoji the deletion will be a no-op because the deletion
   * does not affect nodes w/ different parents. If this is set to true, then
   * the deletion (of the adjacent InlineEmoji) will occur.
   */
  readonly allowAdjacentInlineEmojiDeletion: boolean;
  /**
   * By default when an interactor is positioned on an edge (so to speak)
   * between two InlineText's the deletion will be a no-op because the deletion
   * does not affect nodes w/ different parents. If this is set to true, then
   * the deletion (of the grapheme in the sibling InlineText) will occur.
   */
  readonly allowAdjacentInlineTextDeletion: boolean;
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
  readonly direction: FlowDirection;
}

export type DeletePayload = TargetPayload & Partial<DeleteOptions>;

export const delete_ = createCoreOperation<DeletePayload>("delete", (state, services, payload) => {
  const options: DeleteOptions = {
    allowAdjacentInlineEmojiDeletion: payload.allowAdjacentInlineEmojiDeletion ?? false,
    allowAdjacentInlineTextDeletion: payload.allowAdjacentInlineTextDeletion ?? false,
    allowMovementInBoundaryCases: payload.allowMovementInBoundaryCases ?? false,
    allowJoiningBlocksInBoundaryCases: payload.allowJoiningBlocksInBoundaryCases ?? false,
    direction: payload.direction ?? FlowDirection.Backward,
  };

  const targets = selectTargets(state, services, payload.target);

  for (const target of lodash.reverse(targets)) {
    if (target.isSelection) {
      // Selection/range deletion
      const range = getRangeForSelection(target.interactor, state, services);
      if (!range) {
        continue;
      }

      state.deleteNodesInRange(range, {
        flow: target.isMainCursorFirst ? FlowDirection.Backward : FlowDirection.Forward,
      });

      // Clear selection
      state.updateInteractor(target.interactor.id, {
        selectTo: undefined,
      });
    } else {
      const { interactor, navigator } = target;

      const result = findNodeRelativeToCursorForDeletion(navigator as ReadonlyCursorNavigator, options);
      if (result?.nodeToDelete) {
        // Individual node deletion
        state.deleteNodeAtPath(result.nodeToDelete.path, { flow: payload.direction });
      } else if (result?.justMoveTo) {
        // Just move the anchor/interactor
        state.updateInteractor(interactor.id, {
          to: services.interactors.cursorNavigatorToAnchorPosition(result.justMoveTo),
        });
      } else if (result?.joinInstead) {
        // Join instead of delete
        if (state.getInteractor(interactor.id) === undefined) {
          continue;
        }

        services.execute(state, joinBlocks({ target: { interactorId: interactor.id }, direction: options.direction }));
      }
    }
  }
});

/**
 * This function identifies the proper node to delete based on the passed in
 * navigator, which comes from an interactor's `mainCursor`.
 *
 * Depending on the passed in `DeleteAtOptions` instead of a deletion sometimes
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
  if (NodeUtils.isGrapheme(currentNode)) {
    const parentAndTip = navigator.chain.getParentAndTipIfPossible();
    if (!parentAndTip) {
      return undefined;
    }
    const [parent, tip] = parentAndTip;

    if (!NodeUtils.isTextContainer(parent.node)) {
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

    // Are we at the edge of the text containing Node (InlineText or InlineUrlLink?)
    if ((isBack && index === -1) || (!isBack && index === parent.node.children.length)) {
      const navPrime = navigator.clone();
      const parentHasPrecedingOrFollowingSibling =
        navPrime.navigateToParentUnchecked() &&
        (isBack ? navPrime.navigateToPrecedingSiblingUnchecked() : navPrime.navigateToNextSiblingUnchecked());

      // In the code here, we just handle the case where we are deleting
      // backwards (or forwards) from one InlineText to another inside the
      // same block (e.g. ParagraphBlock)
      if (
        options.allowAdjacentInlineTextDeletion &&
        parent.node instanceof InlineText &&
        parentHasPrecedingOrFollowingSibling &&
        navPrime.tip.node instanceof InlineText
      ) {
        isBack ? navPrime.navigateToLastDescendantCursorPosition() : navPrime.navigateToFirstDescendantCursorPosition();
        if (isBack && navPrime.cursor.orientation === CursorOrientation.Before) {
          navPrime.changeCursorOrientationUnchecked(CursorOrientation.After);
        } else if (!isBack && navPrime.cursor.orientation === CursorOrientation.After) {
          navPrime.changeCursorOrientationUnchecked(CursorOrientation.Before);
        }
        return findNodeRelativeToCursorForDeletion(navPrime, options);
      }

      // In this case we are handling deleting backwards or forwards onto an emoji
      if (
        options.allowAdjacentInlineEmojiDeletion &&
        parent.node instanceof InlineText &&
        parentHasPrecedingOrFollowingSibling &&
        navPrime.tip.node instanceof InlineEmoji
      ) {
        isBack ? navPrime.navigateToLastDescendantCursorPosition() : navPrime.navigateToFirstDescendantCursorPosition();
        if (isBack && navPrime.cursor.orientation === CursorOrientation.Before) {
          navPrime.changeCursorOrientationUnchecked(CursorOrientation.After);
        } else if (!isBack && navPrime.cursor.orientation === CursorOrientation.After) {
          navPrime.changeCursorOrientationUnchecked(CursorOrientation.Before);
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
      if (parent.node.text.length === 1 && parent.node instanceof InlineText) {
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
  } else if (options.allowAdjacentInlineEmojiDeletion) {
    // Orientation has to be before or after here in this block
    if ((orientation === CursorOrientation.After && isBack) || (orientation === CursorOrientation.Before && !isBack)) {
      if (nodeToDelete.tip.node instanceof InlineEmoji) {
        return { nodeToDelete };
      }
    } else {
      // This case is either before and going back or after and going forward
      const navPrime = nodeToDelete.clone();
      if (
        (isBack ? navPrime.navigateToPrecedingSibling() : navPrime.navigateToNextSibling()) &&
        navPrime.tip.node instanceof InlineEmoji
      ) {
        return { nodeToDelete: navPrime };
      }
    }
  }

  // Non-deletion potential movement logic
  if (options.allowMovementInBoundaryCases) {
    const navPrime = navigator.clone();
    isBack ? navPrime.navigateToPrecedingCursorPosition() : navPrime.navigateToNextCursorPosition();
    return { justMoveTo: navPrime };
  }
  return undefined;
}
