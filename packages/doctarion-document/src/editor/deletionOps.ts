import * as immer from "immer";
import lodash from "lodash";

import { LiftingPathMap, NodeNavigator, PathAdjustmentDueToRelativeDeletionNoChangeReason } from "../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation, ReadonlyCursorNavigator } from "../cursor";
import { InlineText, NodeUtils } from "../models";

import { InteractorId, InteractorOrderingEntryCursorType } from "./interactor";
import { createCoreOperation } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { TargetPayload } from "./payloads";
import { EditorOperationServices } from "./services";
import { selectTargets } from "./utils";

const castDraft = immer.castDraft;

export enum DeleteAtDirection {
  Backward = "BACKWARD",
  Forward = "FORWARD",
}

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
  // FUTURE TODO readonly allowJoiningInSomeBoundaryCases?: boolean;
  readonly direction: DeleteAtDirection;
  readonly dontThrowOnSelectionInteractors: boolean;
}

export type DeleteAtPayload = TargetPayload & Partial<DeleteAtOptions>;

export const deleteAt = createCoreOperation<DeleteAtPayload>("delete/at", (state, services, payload) => {
  const options: DeleteAtOptions = {
    allowAdjacentInlineEmojiDeletion: payload.allowAdjacentInlineEmojiDeletion ?? false,
    allowAdjacentInlineTextDeletion: payload.allowAdjacentInlineTextDeletion ?? false,
    allowMovementInBoundaryCases: payload.allowMovementInBoundaryCases ?? false,
    direction: payload.direction ?? DeleteAtDirection.Backward,
    dontThrowOnSelectionInteractors: payload.dontThrowOnSelectionInteractors ?? false,
  };

  const updatedInteractors: Set<InteractorId> = new Set();

  const targets = selectTargets(state, services, payload.target);

  const toDelete = new LiftingPathMap<{
    readonly nodeToDelete: NodeNavigator;
    readonly originalPosition: ReadonlyCursorNavigator;
  }>();

  for (const { interactor, navigator } of targets) {
    // Skip any interactor (or throw error) if the interactor is a selection (for now)
    if (interactor && interactor.isSelection) {
      if (!payload.dontThrowOnSelectionInteractors) {
        throw new EditorOperationError(EditorOperationErrorCode.SelectionNotAllowed);
      }
    }

    const result = findNodeForDeletion(navigator as ReadonlyCursorNavigator, options);
    if (result?.nodeToDelete) {
      toDelete.add(result.nodeToDelete.path, { nodeToDelete: result.nodeToDelete, originalPosition: navigator });
    } else if (result?.justMoveTo) {
      // Sometimes deletion doesn't actually trigger the removal of the node, just
      // the updating of an interactor
      interactor.mainCursor = castDraft(result.justMoveTo).cursor;
      updatedInteractors.add(interactor.id);
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
    adjustInteractorPositionsAfterNodeDeletion(services, nodeToDelete, updatedInteractors, postDeleteCursor);
  }

  services.interactors.notifyUpdated(Array.from(updatedInteractors));
});

export const deleteSelection = createCoreOperation("delete/selection", (state, services) => {
  // TODO merge w/ deletaeAt
  const interactor = state.interactors[Object.keys(state.interactors)[0]];
  if (!interactor.isSelection) {
    throw new EditorOperationError(EditorOperationErrorCode.SelectionRequired);
  }

  const range = interactor.toRange(state.document);
  if (!range) {
    return;
  }

  {
    const elementsToDelete = range.getChainsCoveringRange(state.document);
    elementsToDelete.reverse();
    const nav = new NodeNavigator(state.document);
    for (const chain of elementsToDelete) {
      nav.navigateTo(chain.path);
      deleteNode(nav, services);
    }
  }

  // This navigator is positioned on the place we will leave the selection after the deletion
  {
    // const nav = new CursorNavigator(state.document) ;
    // nav.navigateTo(range.from, CursorOrientation.Before);
    // state.interactors[Object.keys(state.interactors)[0]].mainCursor = castDraft(nav.cursor);
    // state.interactors[Object.keys(state.interactors)[0]].selectionAnchorCursor = undefined;
    // state.interactors[Object.keys(state.interactors)[0]].visualLineMovementHorizontalAnchor = undefined;
  }
});

function adjustInteractorPositionsAfterNodeDeletion(
  services: EditorOperationServices,
  nodeToDelete: NodeNavigator,
  updatedInteractors: Set<string>,
  postDeleteCursor: CursorNavigator
) {
  for (const { interactor, cursorType } of services.interactors.interactorCursorsAtOrAfter(
    new Cursor(nodeToDelete.path, CursorOrientation.Before)
  )) {
    const newCursorOrNoChangeReason = (cursorType === InteractorOrderingEntryCursorType.Main
      ? interactor.mainCursor
      : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        interactor.selectionAnchorCursor!
    ).adjustDueToRelativeDeletionAt(nodeToDelete.path);

    if (newCursorOrNoChangeReason instanceof Cursor) {
      if (cursorType === InteractorOrderingEntryCursorType.Main) {
        interactor.mainCursor = castDraft(newCursorOrNoChangeReason);
      } else {
        interactor.selectionAnchorCursor = castDraft(newCursorOrNoChangeReason);
      }
      updatedInteractors.add(interactor.id);
    } else if (
      newCursorOrNoChangeReason === PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeBecauseAncestor ||
      newCursorOrNoChangeReason === PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeBecauseEqual
    ) {
      if (cursorType === InteractorOrderingEntryCursorType.Main) {
        interactor.mainCursor = castDraft(postDeleteCursor.cursor);
      } else {
        interactor.selectionAnchorCursor = castDraft(postDeleteCursor.cursor);
      }
      updatedInteractors.add(interactor.id);
    }
  }
}

function deleteNode(nodeNavigator: NodeNavigator, services: EditorOperationServices): void {
  const node = nodeNavigator.tip.node;
  const parent = nodeNavigator.parent;
  const pathPart = nodeNavigator.tip.pathPart;

  if (!parent || !pathPart) {
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
  originalPosition: ReadonlyCursorNavigator,
  direction: DeleteAtDirection
): CursorNavigator {
  // The node that the `originalPosition` navigator is pointed to is now
  // deleted, along with (possibly) its parent and grandparent.

  const n = originalPosition.clone();
  if (n.navigateToUnchecked(originalPosition.cursor)) {
    if (NodeUtils.isGrapheme(originalPosition.tip.node)) {
      if (n.parent?.node === originalPosition.parent?.node) {
        const currentIndex = n.tip.pathPart.index;
        const isBack = direction === undefined || direction === DeleteAtDirection.Backward;
        isBack ? n.navigateToPrecedingCursorPosition() : n.navigateToNextCursorPosition();

        // This fixes a bug where we navigate back but the only thing that
        // changes is the CursorOrientation
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
    }
    if (n.navigateToPrecedingSiblingUnchecked()) {
      n.navigateToLastDescendantCursorPosition();
    } else {
      n.navigateToFirstDescendantCursorPosition();
    }
  } else {
    // Try one level higher as a fallback
    const p = originalPosition.cursor.path.withoutTip();
    if (n.navigateToUnchecked(new Cursor(p, CursorOrientation.On))) {
      n.navigateToLastDescendantCursorPosition();
    } else {
      // OK try one more level higher again
      const p2 = originalPosition.cursor.path.withoutTip().withoutTip();
      if (n.navigateToUnchecked(new Cursor(p2, CursorOrientation.On))) {
        // Not sure this is really right...
        n.navigateToLastDescendantCursorPosition();
      } else {
        throw new Error("Could not refresh navigator is not a valid cursor");
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
): { readonly justMoveTo?: CursorNavigator; readonly nodeToDelete?: NodeNavigator } | undefined {
  const isBack = options.direction === DeleteAtDirection.Backward;
  const nodeToDelete = navigator.toNodeNavigator();

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
      if (navigator.cursor.orientation === CursorOrientation.Before) {
        index--;
      }
    } else {
      if (navigator.cursor.orientation === CursorOrientation.After) {
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
        // Proceed with deletion at the end of the prior (assumed)
        // InlineText) ...
        return findNodeForDeletion(navPrime, options);
      }

      // Joining logic should probably be added here in the future

      // Reach possible movement logic outside of switch
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
  } else if (navigator.cursor.orientation === CursorOrientation.On) {
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
