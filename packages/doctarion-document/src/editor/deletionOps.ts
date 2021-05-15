import * as immer from "immer";

import { NodeNavigator } from "../basic-traversal";
import { CursorNavigator, CursorOrientation, PositionClassification } from "../cursor";
import { InlineText, NodeUtils } from "../models";

import { createCoreCommonOperation } from "./coreOperations";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { EditorOperationServices } from "./services";
import { ifLet, refreshNavigator } from "./utils";

const castDraft = immer.castDraft;

export const deleteBackwards = createCoreCommonOperation("delete/backwards", ({ state, services, navigator }) => {
  switch (navigator.classifyCurrentPosition()) {
    case PositionClassification.Grapheme:
      ifLet(navigator.chain.getParentAndTipIfPossible(), ([parent, tip]) => {
        if (!NodeUtils.isTextContainer(parent.node)) {
          return false;
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
            deleteNode(navPrime, services);

            navigator = refreshNavigator(navigator);
            navigator.navigateToParentUnchecked();
            navigator.navigateToPrecedingSiblingUnchecked();
            navigator.navigateToLastDescendantCursorPosition();
          } else {
            castDraft(parent.node).text.splice(index, 1);
            // Would it be better to just try jumping to something?
            navigator.navigateToPrecedingCursorPosition();
            // This fixes a bug where we navigate back but the only thing that changes is the CursorOrientation
            if (
              navigator.tip.pathPart &&
              navigator.tip.pathPart.index === index &&
              navigator.cursor.orientation === CursorOrientation.Before &&
              navigator.toNodeNavigator().navigateToPrecedingSibling()
            ) {
              navigator.navigateToPrecedingCursorPosition();
            }
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
        }
      });
      break;
    case PositionClassification.EmptyInsertionPoint:
    case PositionClassification.NavigableNonTextNode:
      deleteNode(navigator.toNodeNavigator(), services);
      navigator = refreshNavigator(navigator);
      navigator.navigateToPrecedingSiblingUnchecked();
      navigator.navigateToLastDescendantCursorPosition();
      break;
    case PositionClassification.InBetweenInsertionPoint:
      navigator.navigateToPrecedingCursorPosition();
      break;
  }
  state.cursor = castDraft(navigator.cursor);
});

export const deleteSelection = createCoreCommonOperation("delete/selection", ({ state, services }): void => {
  if (!state.selection || !state.selectionAnchor) {
    throw new EditorOperationError(EditorOperationErrorCode.SelectionRequired);
  }

  {
    const elementsToDelete = state.selection.getChainsCoveringRange(state.document);
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
    nav.navigateTo(state.selection.from, CursorOrientation.Before);
    state.cursor = castDraft(nav.cursor);
  }
  state.selectionAnchor = undefined;
  state.selection = undefined;
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
