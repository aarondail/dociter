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
import { ifLet, selectTargets } from "./utils";

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

    console.log("deleteing node: ", primary.nodeToDelete.path.toString());
    deleteNode(primary.nodeToDelete, services);

    const postDeleteCursor = (primary.newNavigatorPosition instanceof CursorNavigator
      ? primary.newNavigatorPosition
      : primary.newNavigatorPosition()
    ).cursor;
    const n3 = new NodeNavigator(state.document);
    n3.navigateTo(postDeleteCursor.path);
    console.log(
      "postdelecursor ",
      postDeleteCursor.toString(),
      immer.isDraft(n3.tip.node) ? immer.current(n3.tip.node) : n3.tip.node
    );

    // Now, for all interactor cursors (main or selection) after this node,
    // update them to account for the deletion
    for (const { interactor, cursorType } of services.interactors.interactorCursorsAtOrAfter(
      new Cursor(primary.nodeToDelete.path, CursorOrientation.Before)
    )) {
      console.log("HERE in updating interactor", immer.current(interactor), cursorType, postDeleteCursor.toString());

      const newCursorOrNoChangeReason = (cursorType === InteractorOrderingEntryCursorType.Main
        ? interactor.mainCursor
        : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          interactor.selectionAnchorCursor!
      ).adjustDueToRelativeDeletionAt(primary.nodeToDelete.path);

      console.log(newCursorOrNoChangeReason.toString());

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

  console.log(navigator.cursor.toString(), "::::", nodeToDelete.tip.node);
  const cursorPositionType = navigator.classifyCurrentPosition();
  switch (cursorPositionType) {
    case PositionClassification.Grapheme:
      return ifLet(navigator.chain.getParentAndTipIfPossible(), ([parent, tip]) => {
        if (!NodeUtils.isTextContainer(parent.node)) {
          return undefined;
        }

        let index = tip.pathPart.index;
        if (direction === DeleteAtDirection.Backward) {
          if (navigator.cursor.orientation === CursorOrientation.Before) {
            index--;
          }
        } else {
          if (navigator.cursor.orientation === CursorOrientation.After) {
            index++;
            nodeToDelete.navigateToNextSibling();
          }
        }
        console.log("B", index);
        if (index === -1) {
          // This case is typically when we are on the very first code point of
          // the very first inline text in a block element. That is because the
          // cursor navigation code prefers to give the cursor an after
          // orientation in most cases except for the first character of the
          // first inline text in a block. But, not all cases.
          //
          // The other case this can happen is in a block with multiple inlines
          // and, due to line wrapping, we prefer the before orientation for
          // code points that start a new line (visually).
          //
          // In the code here, we just handle the case where we are deleting
          // backwards from one InlineText to another inside the same block
          // (e.g. ParagraphBlock)
          const navPrime = navigator.clone();
          if (
            parent.node instanceof InlineText &&
            navPrime.navigateToParentUnchecked() &&
            navPrime.navigateToPrecedingSiblingUnchecked() &&
            navPrime.navigateToLastDescendantCursorPosition()
          ) {
            if (navPrime.cursor.orientation === CursorOrientation.Before) {
              navPrime.changeCursorOrientationUnchecked(CursorOrientation.After);
            }
            // Proceed with deletion at the end of the prior (assumed)
            // InlineText) ...
            return preprocessNodeForDeletion(navPrime, direction);
          }
          // If we get here, probably this is the first InlineText in a block
          // which for now we don't handle.  In the future this may need to
          // delete "backwards" from one block to another. But for now that is
          // not implemented.
          return undefined;
        } else if (index === parent.node.children.length) {
          // In this case we are deleting one past the end of the current InlineText
          // This is pretty similar to the situation above just the obverse.
          const navPrime = navigator.clone();
          if (
            parent.node instanceof InlineText &&
            navPrime.navigateToParentUnchecked() &&
            navPrime.navigateToNextSiblingUnchecked() &&
            navPrime.navigateToFirstDescendantCursorPosition()
          ) {
            if (navPrime.cursor.orientation === CursorOrientation.After) {
              navPrime.changeCursorOrientationUnchecked(CursorOrientation.Before);
            }
            // Proceed with deletion at the end of the prior (assumed)
            // InlineText)
            return preprocessNodeForDeletion(navPrime, direction);
          }
          // If we get here, probably this is the last InlineText in a block
          // which for now we don't handle.  In the future this may need to
          // delete "forwards" from one block to another. But for now that is
          // not implemented.
          return undefined;
        } else {
          if (parent.node.text.length === 1 && parent.node instanceof InlineText) {
            // In this case we are about to remove the last character in an
            // inline text In this case, we prefer to delete the inline text.
            const navPrime = navigator.toNodeNavigator();
            console.log(navPrime.path.toString());
            navPrime.navigateToParent();
            return {
              newNavigatorPosition: () => {
                return retargtedNavigatorAfterDeletion(navigator, cursorPositionType, direction);
                // const nav2 = refreshNavigator(navigator);
                // console.log("nav2", nav2.cursor.toString());
                // nav2.navigateToParentUnchecked();
                // console.log("nav2", nav2.cursor.toString());
                // nav2.navigateToPrecedingSiblingUnchecked();
                // console.log("nav2", nav2.cursor.toString());
                // nav2.navigateToLastDescendantCursorPosition();
                // console.log("nav2", nav2.cursor.toString());
                // return nav2;
              },
              nodeToDelete: navPrime,
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
        }
      });
    case PositionClassification.EmptyInsertionPoint:
    case PositionClassification.NavigableNonTextNode:
      return {
        nodeToDelete,
        newNavigatorPosition: () => retargtedNavigatorAfterDeletion(navigator, cursorPositionType, direction),
      };
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

function retargtedNavigatorAfterDeletion(
  nav: CursorNavigator,
  positionClassification: PositionClassification,
  direction?: DeleteAtDirection
): CursorNavigator {
  // The node that the navigator is pointed to is now deleted, along with
  // (possibly) its parent and even grand parent (I think?).

  const n = new CursorNavigator(nav.document);
  if (n.navigateToUnchecked(nav.cursor)) {
    console.log("qqqq1");
    // OK we were able to navigate to the same cursor location but a different
    // node
    if (positionClassification === PositionClassification.Grapheme) {
      console.log("qqqq2");
      n.navigateToParentUnchecked();
    }
    if (n.navigateToPrecedingSiblingUnchecked()) {
      console.log("qqqq20a", n.cursor.toString());
      n.navigateToLastDescendantCursorPosition();
    } else {
      console.log("qqqq20b");
      n.navigateToFirstDescendantCursorPosition();
    }
  } else {
    console.log("qqqq1b");
    // Try one level higher as a fallback
    const p = nav.cursor.path.withoutTip();
    if (n.navigateToUnchecked(new Cursor(p, CursorOrientation.On))) {
      console.log("qqqq3a");

      n.navigateToLastDescendantCursorPosition();
      // if (n.navigateToPrecedingSiblingUnchecked()) {
      //   n.navigateToLastDescendantCursorPosition();
      // } else {
      //   n.navigateToFirstDescendantCursorPosition();
      // }
    } else {
      console.log("qqqq3b");
      // OK try one more level higher again
      const p2 = nav.cursor.path.withoutTip().withoutTip();
      if (n.navigateToUnchecked(new Cursor(p2, CursorOrientation.On))) {
        // Not sure this is really right...
        n.navigateToLastDescendantCursorPosition();
        console.log("qqqq4");
      } else {
        throw new Error("Could not refresh navigator is not a valid cursor");
      }
    }
  }
  return n;
}
