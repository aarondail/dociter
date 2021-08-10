import * as immer from "immer";
import { Draft } from "immer";
import lodash from "lodash";

import {
  LiftingPathMap,
  NodeNavigator,
  Path,
  PathAdjustmentDueToRelativeDeletionNoChangeReason,
  PathString,
} from "../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation, ReadonlyCursorNavigator } from "../cursor";
import { Document, InlineEmoji, InlineText, NodeUtils } from "../models";

import { Interactor, InteractorOrderingEntry } from "./interactor";
import { joinBlocks } from "./joinOps";
import { createCoreOperation } from "./operation";
import { TargetPayload } from "./payloads";
import { EditorOperationServices } from "./services";
import { FlowDirection, selectTargets } from "./utils";

const castDraft = immer.castDraft;

interface DeleteAtOptions {
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
  readonly dontThrowOnSelectionInteractors: boolean;
}

export type DeleteAtPayload = TargetPayload & Partial<DeleteAtOptions>;

export const deleteAt = createCoreOperation<DeleteAtPayload>("delete/at", (state, services, payload) => {
  const options: DeleteAtOptions = {
    allowAdjacentInlineEmojiDeletion: payload.allowAdjacentInlineEmojiDeletion ?? false,
    allowAdjacentInlineTextDeletion: payload.allowAdjacentInlineTextDeletion ?? false,
    allowMovementInBoundaryCases: payload.allowMovementInBoundaryCases ?? false,
    allowJoiningBlocksInBoundaryCases: payload.allowJoiningBlocksInBoundaryCases ?? false,
    direction: payload.direction ?? FlowDirection.Backward,
    dontThrowOnSelectionInteractors: payload.dontThrowOnSelectionInteractors ?? false,
  };

  const targets = selectTargets(state, services, payload.target);

  const toDelete = new LiftingPathMap<{
    readonly nodeToDelete: NodeNavigator;
    readonly originalPosition: ReadonlyCursorNavigator;
  }>();
  const toJoin: Draft<Interactor>[] = [];

  for (const target of targets) {
    if (target.isSelection) {
      const chainsToDelete = target.interactor.toRange(state.document)?.getChainsCoveringRange(state.document);

      if (chainsToDelete) {
        // TODO this is probably a very inefficient way to deal with text
        for (const chain of chainsToDelete) {
          const nav = new NodeNavigator(state.document);
          nav.navigateTo(chain.path);
          toDelete.add(chain.path, {
            nodeToDelete: nav,
            originalPosition:
              options.direction === FlowDirection.Backward ? target.navigators[0] : target.navigators[1],
          });
        }
      }
    } else {
      const { interactor, navigator } = target;

      const result = findNodeForDeletion(navigator as ReadonlyCursorNavigator, options);
      if (result?.nodeToDelete) {
        toDelete.add(result.nodeToDelete.path, { nodeToDelete: result.nodeToDelete, originalPosition: navigator });
      } else if (result?.justMoveTo) {
        // Sometimes deletion doesn't actually trigger the removal of the node, just
        // the updating of an interactor
        interactor.mainCursor = castDraft(result.justMoveTo).cursor;
        services.interactors.notifyUpdated(interactor.id);
      } else if (result?.joinInstead) {
        toJoin.push(interactor);
      }
    }
  }

  // So at this point, in `toDelete` we have all nodes that need to be deleted.
  //
  // Next we walk backwards through the nodes there and delete them.  Note in
  // `toDelete` if there are two nodes that are in an ancestor/descendant
  // relationship only the ancestor will come up in the traversal (the
  // descendants will be part of the "liftedElements").

  for (const toDeleteEntry of lodash.reverse(toDelete.getAllOrderedByPaths())) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { nodeToDelete, originalPosition } = lodash.first(toDeleteEntry.elements)!;
    // This JUST deletes the node from the document
    deleteNode(nodeToDelete, services);

    const postDeleteCursor = determineCursorPositionAfterDeletion(originalPosition, options.direction);

    // Now, for all interactor cursors (main or selection) after this node,
    // update them to account for the deletion
    adjustInteractorPositionsAfterNodeDeletion(services, nodeToDelete.path, postDeleteCursor);
  }

  // Now process the joins if there were any This is probably not right, in the
  // sense that the deletions and joins are processed separately...
  for (const interactor of toJoin) {
    // Make sure interactor still exists
    if (state.interactors[interactor.id] == undefined) {
      continue;
    }

    services.execute(
      state,
      joinBlocks({
        target: { interactorId: interactor.id },
        // Should this be its own option?
        mergeCompatibleInlineTextsIfPossible: true,
        direction: options.direction,
      })
    );
  }
});

export const deletePrimitive = createCoreOperation<{ path: Path | PathString }>(
  "delete/primitive",
  (state, services, payload) => {
    const nodeToDelete = new NodeNavigator(state.document);
    const originalCursorPosition = new CursorNavigator(state.document, services.layout);

    if (!nodeToDelete.navigateTo(payload.path) || !originalCursorPosition.navigateTo(payload.path)) {
      return;
    }

    deleteNode(nodeToDelete, services);

    const postDeleteCursor = determineCursorPositionAfterDeletion(originalCursorPosition, FlowDirection.Backward);

    // Now, for all interactor cursors (main or selection) after this node,
    // update them to account for the deletion
    adjustInteractorPositionsAfterNodeDeletion(services, nodeToDelete.path, postDeleteCursor);
  }
);

function adjustInteractorPositionsAfterNodeDeletion(
  services: EditorOperationServices,
  nodeToDelete: Path,
  postDeleteCursor: CursorNavigator
) {
  for (const { interactor, cursorType } of services.interactors.interactorCursorsAtOrAfter(
    new Cursor(nodeToDelete, CursorOrientation.Before)
  )) {
    const newCursorOrNoChangeReason = InteractorOrderingEntry.getCursor(
      interactor,
      cursorType
    ).adjustDueToRelativeDeletionAt(nodeToDelete);

    if (newCursorOrNoChangeReason instanceof Cursor) {
      InteractorOrderingEntry.setCursor(interactor, cursorType, newCursorOrNoChangeReason);
      services.interactors.notifyUpdated(interactor.id);
    } else if (
      newCursorOrNoChangeReason === PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeBecauseAncestor ||
      newCursorOrNoChangeReason === PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeBecauseEqual
    ) {
      InteractorOrderingEntry.setCursor(interactor, cursorType, postDeleteCursor.cursor);
      services.interactors.notifyUpdated(interactor.id);
    }
  }
}

function deleteNode(nodeNavigator: NodeNavigator, services: EditorOperationServices): void {
  const node = nodeNavigator.tip.node;
  const parent = nodeNavigator.parent;
  const pathPart = nodeNavigator.tip.pathPart;

  if (!parent || !pathPart) {
    if (node instanceof Document) {
      nodeNavigator.traverseDescendants((node) => services.tracking.unregister(node), {
        skipGraphemes: true,
      });
      castDraft(node).children = [];
    }
    return;
  }

  const kids = NodeUtils.getChildren(parent.node);
  const kidIndex = pathPart.index;

  if (!kids) {
    return;
  }

  // Unregister all child nodes and the node itself
  if (!NodeUtils.isGrapheme(node)) {
    nodeNavigator.traverseDescendants((node) => services.tracking.unregister(node), {
      skipGraphemes: true,
    });
    services.tracking.unregister(node);
  }

  castDraft(kids).splice(kidIndex, 1);
}

function determineCursorPositionAfterDeletion(
  originalPositionAndNode: ReadonlyCursorNavigator,
  direction: FlowDirection
): CursorNavigator {
  // The node that the `originalPosition` navigator is pointed to is now
  // deleted, along with (possibly) its parent and grandparent.
  const originalNode = originalPositionAndNode.tip.node;
  const originalParent = originalPositionAndNode.parent?.node;
  const originalCursor = originalPositionAndNode.cursor;
  const isBack = direction === undefined || direction === FlowDirection.Backward;

  const n = originalPositionAndNode.clone();
  if (n.navigateToUnchecked(originalCursor)) {
    if (NodeUtils.isGrapheme(originalNode)) {
      if (n.parent?.node === originalParent) {
        const currentIndex = n.tip.pathPart.index;
        isBack ? n.navigateToPrecedingCursorPosition() : n.navigateToNextCursorPosition();

        // This fixes a bug where we navigate but the only thing that changed is
        // the CursorOrientation
        if (
          n.tip.pathPart &&
          n.tip.pathPart.index === currentIndex &&
          n.cursor.orientation === (isBack ? CursorOrientation.Before : CursorOrientation.After) &&
          (isBack ? n.toNodeNavigator().navigateToPrecedingSibling() : n.toNodeNavigator().navigateToNextSibling())
        ) {
          isBack ? n.navigateToPrecedingCursorPosition() : n.navigateToNextCursorPosition();
        }
        return n;
      }
      // OK we were able to navigate to the same cursor location but a different
      // node or parent node
      n.navigateToParentUnchecked();
    } else if (originalNode instanceof InlineEmoji) {
      if (n.parent?.node === originalPositionAndNode.parent?.node) {
        const currentIndex = n.tip.pathPart.index;
        // JIC this node is an InlineUrlText or something do this
        n.navigateToFirstDescendantCursorPosition();
        // Then move the previous position... this actually works properly no
        // matter which direction we were moving... mostly. The check for here
        // is saying that if we are moving forward and landed On something
        // (which must be an empty inline text or emoji) don't move. This is a
        // little bit weird and specific so the logic here could definitely be
        // wrong.
        if (isBack || n.cursor.orientation !== CursorOrientation.On) {
          n.navigateToPrecedingCursorPosition();
        }

        // This fixes a bug where we navigate but the only thing that changed is
        // the CursorOrientation
        if (n.tip.pathPart && n.tip.pathPart.index === currentIndex) {
          if (n.cursor.orientation === CursorOrientation.On && originalCursor.orientation !== CursorOrientation.On) {
            isBack ? n.navigateToPrecedingCursorPosition() : n.navigateToNextCursorPosition();
          }
        }
        return n;
      }
      // OK we were able to navigate to the same cursor location but a different
      // node or parent node
      n.navigateToParentUnchecked();
    }
    if (n.navigateToPrecedingSiblingUnchecked()) {
      if (direction === FlowDirection.Forward && NodeUtils.isBlock(n.tip.node) && n.navigateToNextSiblingUnchecked()) {
        n.navigateToFirstDescendantCursorPosition();
      } else {
        n.navigateToLastDescendantCursorPosition();
      }
    } else {
      n.navigateToFirstDescendantCursorPosition();
    }
  } else {
    // Try one level higher as a fallback
    const p = originalCursor.path.withoutTip();
    if (n.navigateToUnchecked(new Cursor(p, CursorOrientation.On))) {
      n.navigateToLastDescendantCursorPosition();
    } else {
      // OK try one more level higher again
      const p2 = originalCursor.path.withoutTip().withoutTip();
      if (n.navigateToUnchecked(new Cursor(p2, CursorOrientation.On))) {
        // Not sure this is really right...
        n.navigateToLastDescendantCursorPosition();
      } else {
        // Not sure this is really right...
        if (!n.navigateToDocumentNodeUnchecked() || !n.navigateToFirstDescendantCursorPosition()) {
          throw new Error("Could not refresh navigator is not a valid cursor");
        }
      }
    }
  }
  return n;
}

/**
 * This function identifies the proper node to delete based on the passed in navigator, which
 * comes from an interactor's `mainCursor`.
 *
 * Depending on the passed in `DeleteAtOptions` instead of a deletion sometimes
 * movement can occur. In this case a CursorNavigator representing the new
 * position for the interactor is returned.
 *
 * Also undefined can be returned, indicating there is nothing to delete and the
 * interactor does not need to be moved.
 */
function findNodeForDeletion(
  navigator: ReadonlyCursorNavigator,
  options: DeleteAtOptions
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

    let index = tip.pathPart.index;
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
        return findNodeForDeletion(navPrime, options);
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
        return findNodeForDeletion(navPrime, options);
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
