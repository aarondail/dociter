import * as immer from "immer";
import lodash from "lodash";

import { LiftingPathMap, NodeNavigator, PathAdjustmentDueToRelativeDeletionNoChangeReason } from "../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation, PositionClassification, ReadonlyCursorNavigator } from "../cursor";
import { InlineText, NodeUtils } from "../models";

import { InteractorId, InteractorOrderingEntryCursorType } from "./interactor";
import { createCoreOperation } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { TargetPayload } from "./payloads";
import { EditorOperationServices } from "./services";
import { ifLet, selectTargets } from "./utils";

const castDraft = immer.castDraft;

export enum DeleteAtDirection {
  Backward = "BACKWARD",
  Forward = "FORWARD",
}

export type DeleteAtPayload = TargetPayload & {
  readonly direction?: DeleteAtDirection;
  readonly dontThrowOnSelectionInteractors?: boolean;
  // TODO continue from here, and go through rest of doc. ALSO -- fix the problem with multiple movement commands being
  // done at same time (with the post-dlete cursor positions calculated before deletion leading to
  // inaccurante rresults)
  //
  // readonly allowJoiningInSomeBoundaryCases?: boolean;
  // readonly allowMovementInBoundaryCases?: boolean;
};
/**
 * This will throw an error if any of the target interactors are selections
 * unless `dontThrowOnSelectionInteractors` is set to true.
 */
export const deleteAt = createCoreOperation<DeleteAtPayload>("delete/at", (state, services, payload) => {
  const direction = payload.direction ?? DeleteAtDirection.Backward;
  const updatedInteractors: Set<InteractorId> = new Set();

  // Targets is an array of navigators point to cursor positions to delete, as
  // well as (optionally) the associated interactor.
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

    const result = findNodeForDeletion(navigator as ReadonlyCursorNavigator, direction);
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

    const postDeleteCursor = determineCursorPositionAfterDeletion(originalPosition, direction);

    // Now, for all interactor cursors (main or selection) after this node,
    // update them to account for the deletion
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

/**
 * This function takes a navigator pointing to a node as well as a direction
 * indicating whether want to try deleting before the navigator position or
 * after the navigator position. It returns a navigator pointing to the proper
 * node to delete or, if deletion doesn't make logical sense, a cursor navigator
 * pointing to a new node to move to.
 *
 * Also undefined can be returned, indicating there is nothing to delete and the
 * navigator does not need to be moved.
 */
function findNodeForDeletion(
  navigator: ReadonlyCursorNavigator,
  direction: DeleteAtDirection
): { readonly justMoveTo?: CursorNavigator; readonly nodeToDelete?: NodeNavigator } | undefined {
  const nodeToDelete = navigator.toNodeNavigator();

  const cursorPositionType = navigator.classifyCurrentPosition();
  switch (cursorPositionType) {
    case PositionClassification.Grapheme:
      return ifLet(navigator.chain.getParentAndTipIfPossible(), ([parent, tip]) => {
        if (!NodeUtils.isTextContainer(parent.node)) {
          return undefined;
        }

        const isBack = direction === DeleteAtDirection.Backward;
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

        if ((isBack && index === -1) || (!isBack && index === parent.node.children.length)) {
          // In the code here, we just handle the case where we are deleting
          // backwards (or forwards) from one InlineText to another inside the
          // same block (e.g. ParagraphBlock)
          const navPrime = navigator.clone();
          const parentHasPrecedingOrFollowingSibling =
            navPrime.navigateToParentUnchecked() &&
            (isBack ? navPrime.navigateToPrecedingSiblingUnchecked() : navPrime.navigateToNextSiblingUnchecked());
          if (
            parent.node instanceof InlineText &&
            parentHasPrecedingOrFollowingSibling &&
            (isBack
              ? navPrime.navigateToLastDescendantCursorPosition()
              : navPrime.navigateToFirstDescendantCursorPosition())
          ) {
            if (isBack && navPrime.cursor.orientation === CursorOrientation.Before) {
              navPrime.changeCursorOrientationUnchecked(CursorOrientation.After);
            } else if (!isBack && navPrime.cursor.orientation === CursorOrientation.After) {
              navPrime.changeCursorOrientationUnchecked(CursorOrientation.Before);
            }
            // Proceed with deletion at the end of the prior (assumed)
            // InlineText) ...
            return findNodeForDeletion(navPrime, direction);
          }
          // If we get here, probably this is the first InlineText in a block or
          // the start of an InlineText that is preceded by another inline.
          // Which for now we don't handle.  In the future this may need to
          // delete "backwards" from one block to another. But for now that is
          // not implemented.
          return undefined;
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
      });
    case PositionClassification.EmptyInsertionPoint:
    case PositionClassification.NavigableNonTextNode:
      return { nodeToDelete };
    case PositionClassification.InBetweenInsertionPoint: {
      const navPrime = navigator.clone();
      if (direction === DeleteAtDirection.Backward) {
        navPrime.navigateToPrecedingCursorPosition();
      } else {
        navPrime.navigateToNextCursorPosition();
      }
      return { justMoveTo: navPrime };
    }
  }
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
