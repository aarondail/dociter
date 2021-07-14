import * as immer from "immer";
import lodash from "lodash";

import { LiftingPathMap, NodeNavigator, PathAdjustmentDueToRelativeDeletionNoChangeReason } from "../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation, PositionClassification } from "../cursor";
import { hasOwnProperty } from "../miscUtils";
import { InlineText, NodeUtils } from "../models";

import { InteractorId, InteractorOrderingEntryCursorType } from "./interactor";
import { createCoreOperation } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { CursorTargetPayload } from "./payloads";
import { EditorOperationServices } from "./services";
import { ifLet, refreshNavigator, selectTargets } from "./utils";

const castDraft = immer.castDraft;

export enum DeleteAtDirection {
  Backward = "BACKWARD",
  Foreward = "FOREWARD",
}

/**
 * This will throw an error if any of the target interactors are selections
 * unless `dontThrowOnSelectionInteractors` is set to true.
 */
export const deleteAt = createCoreOperation<
  CursorTargetPayload & { direction?: DeleteAtDirection; dontThrowOnSelectionInteractors?: boolean }
>("delete/at", (state, services, payload) => {
  const updatedInteractors: Set<InteractorId> = new Set();

  // Targets is an array of navigators point to cursor positions to delete, as
  // well as (optionally) the associated interactor.
  const targets = selectTargets(state, services, payload.target);
  // These are interactors that are NOT in targets
  // const unselectedInteractors = getUnselectedInteractors(state, payload.target, targets);

  const toDelete = new LiftingPathMap<{
    newNavigatorPosition: CursorNavigator | (() => CursorNavigator);
    nodeToDelete: NodeNavigator;
  }>();
  for (const target of targets) {
    // Skip any interactor (or throw error) if the interactor is a selection
    let interactor = undefined;
    if (hasOwnProperty(target, "interactor")) {
      interactor = target.interactor;
    }
    if (interactor && interactor.isSelection) {
      if (!payload.dontThrowOnSelectionInteractors) {
        throw new EditorOperationError(EditorOperationErrorCode.SelectionNotAllowed);
      }
    }

    const result = preprocessNodeForDeletion(target.navigator, payload.direction);

    if (result?.nodeToDelete) {
      toDelete.add(result.nodeToDelete.path, {
        newNavigatorPosition: result.newNavigatorPosition,
        nodeToDelete: result.nodeToDelete,
      });
    } else if (result && interactor) {
      // Sometimes deletion doesn't actually trigger the removal of the node, just
      // the updating of an interactor... this handles that
      interactor.mainCursor = castDraft(
        (result.newNavigatorPosition instanceof CursorNavigator
          ? result.newNavigatorPosition
          : result.newNavigatorPosition()
        ).cursor
      );
      updatedInteractors.add(interactor.id);
    }
  }

  // So at this point, in `toDelete` we have all nodes that need to be deleted,
  // along with the associated interactor if there was one. Some interactors may
  // have already been updated to a new position but ONLY in the case where
  // there was no node that needed to be deleted.

  // Next we walk backwards through the nodes there and delete them.  Note in
  // `toDelete` if there are two nodes that are in an ancestor/descendant
  // relationship only the ancestor will come up in the traversal (the
  // descendants will be part of the "liftedElements").

  for (const toDeleteEntry of lodash.reverse(toDelete.getAllOrderedByPaths())) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const primary = lodash.first(toDeleteEntry.elements)!;

    deleteNode(primary.nodeToDelete, services);

    const postDeleteCursor = (primary.newNavigatorPosition instanceof CursorNavigator
      ? primary.newNavigatorPosition
      : primary.newNavigatorPosition()
    ).cursor;

    // Now, for all interactor cursors (main or selection) after this node,
    // update them to account for the deletion
    for (const { interactor, cursorType } of services.interactors.interactorCursorsAtOrAfter(postDeleteCursor)) {
      // console.log("HERE in updating interactor", immer.current(interactor), cursorType, postDeleteCursor.toString());

      const newCursorOrNoChangeReason = (cursorType === InteractorOrderingEntryCursorType.Main
        ? interactor.mainCursor
        : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          interactor.selectionAnchorCursor!
      ).adjustDueToRelativeDeletionAt(primary.nodeToDelete.path);

      // console.log(newCursorOrNoChangeReason.toString());

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
          interactor.mainCursor = castDraft(postDeleteCursor);
        } else {
          interactor.selectionAnchorCursor = castDraft(postDeleteCursor);
        }
        updatedInteractors.add(interactor.id);
      }
    }
  }

  services.interactors.notifyUpdated(Array.from(updatedInteractors));
});

export const deleteSelection = createCoreOperation("delete/selection", (state, services) => {
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
    const nav = new CursorNavigator(state.document);
    nav.navigateTo(range.from, CursorOrientation.Before);
    state.interactors[Object.keys(state.interactors)[0]].mainCursor = castDraft(nav.cursor);
    state.interactors[Object.keys(state.interactors)[0]].selectionAnchorCursor = undefined;
    state.interactors[Object.keys(state.interactors)[0]].visualLineMovementHorizontalAnchor = undefined;
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
 * after the navigator position and returns a navigator pointing to the proper
 * node to delete, if there is one, and a cursor navigator pointing to the node
 * the starting navigator (if it is coming from an interactor) should be on
 * after the deletion.
 *
 * Also undefined can be returned, indicating there is nothing to delete and the
 * starting navigator does not need to be moved.
 */
function preprocessNodeForDeletion(
  startingNavigator: CursorNavigator,
  direction?: DeleteAtDirection
):
  | {
      newNavigatorPosition: CursorNavigator | (() => CursorNavigator);
      nodeToDelete: NodeNavigator | null;
    }
  | undefined {
  const navigator = startingNavigator.clone();
  const nodeToDelete = navigator.toNodeNavigator();

  switch (navigator.classifyCurrentPosition()) {
    case PositionClassification.Grapheme:
      return ifLet(navigator.chain.getParentAndTipIfPossible(), ([parent, tip]) => {
        if (!NodeUtils.isTextContainer(parent.node)) {
          return undefined;
        }

        let index = tip.pathPart.index;
        if (navigator.cursor.orientation === CursorOrientation.Before) {
          index--;
        }

        if (index !== -1) {
          if (parent.node.text.length === 1 && parent.node instanceof InlineText) {
            // In this case we are about to remove the last character in an
            // inline text In this case, we prefer to delete the inline text.
            const navPrime = navigator.toNodeNavigator();
            navPrime.navigateToParent();
            return {
              newNavigatorPosition: () => {
                const nav2 = refreshNavigator(navigator);
                nav2.navigateToParentUnchecked();
                nav2.navigateToPrecedingSiblingUnchecked();
                nav2.navigateToLastDescendantCursorPosition();
                return nav2;
              },
              // navigator,
              nodeToDelete: navPrime,
              // oldBehaviorToDeleteSoon: "            deleteNode(navPrime, services);",
            };
          } else {
            // In this case, the nodeToDelete is already on the right node
            // Would it be better to just try jumping to something?
            if (direction === undefined || direction === DeleteAtDirection.Backward) {
              navigator.navigateToPrecedingCursorPosition();

              // This fixes a bug where we navigate back but the only thing that
              // changes is the CursorOrientation
              if (
                navigator.tip.pathPart &&
                navigator.tip.pathPart.index === index &&
                navigator.cursor.orientation === CursorOrientation.Before &&
                navigator.toNodeNavigator().navigateToPrecedingSibling()
              ) {
                navigator.navigateToPrecedingCursorPosition();
              }
            } else {
              navigator.navigateToNextCursorPosition();

              // This fixes a bug where we navigate forward but the only thing
              // that changes is the CursorOrientation
              if (
                navigator.tip.pathPart &&
                navigator.tip.pathPart.index === index &&
                navigator.cursor.orientation === CursorOrientation.After &&
                navigator.toNodeNavigator().navigateToNextSibling()
              ) {
                navigator.navigateToNextCursorPosition();
              }
            }

            return { newNavigatorPosition: navigator, nodeToDelete };
          }
        } else {
          // In this case we are deleting the character behind this one. This
          // doesn't need to do anything in the case of non-InlineText's but for
          // InlineTexts it can try to delete the actual prior text. But because
          // of the way the cursor navigator works this genreally won't happen
          // because it almost always prefers after orientation for graphemes except
          // when it absolutely cannot make that work.
          //
          // To make our lives easier we just do nothing here for now. I
          // think this is ok...
          //
          // In the future this may need to delete "backwards" from one block
          // to another. But for now that is not implemented.
          return undefined;
        }
      });
    case PositionClassification.EmptyInsertionPoint:
    case PositionClassification.NavigableNonTextNode:
      if (direction === undefined || direction === DeleteAtDirection.Backward) {
        return {
          nodeToDelete,
          newNavigatorPosition: () => {
            const nav2 = refreshNavigator(navigator);
            nav2.navigateToPrecedingSiblingUnchecked();
            nav2.navigateToLastDescendantCursorPosition();
            return nav2;
          },
        };
      } else {
        return {
          nodeToDelete,
          newNavigatorPosition: () => {
            const nav2 = refreshNavigator(navigator);
            nav2.navigateToPrecedingSiblingUnchecked();
            nav2.navigateToLastDescendantCursorPosition();
            return nav2;
          },
        };
      }
    case PositionClassification.InBetweenInsertionPoint:
      if (direction === undefined || direction === DeleteAtDirection.Backward) {
        navigator.navigateToPrecedingCursorPosition();
      } else {
        navigator.navigateToNextCursorPosition();
      }
      return {
        newNavigatorPosition: navigator,
        nodeToDelete: null,
      };
  }
}
