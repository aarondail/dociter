import * as immer from "immer";

import { Chain, NodeNavigator, Path, PathPart } from "../basic-traversal";
import { CursorAffinity, CursorNavigator, PositionClassification } from "../cursor";
import { Node } from "../nodes";
import { Range } from "../ranges";

import { resetCursorMovementHints } from "./cursorOps";
import { EditorState } from "./editor";
import { OperationError, OperationErrorCode } from "./error";
import { clearSelection } from "./selectionOps";
import { EditorOperationServices } from "./services";
import { getCursorNavigatorAndValidate, ifLet, refreshNavigator } from "./utils";

const castDraft = immer.castDraft;

export function deleteBackwards(state: immer.Draft<EditorState>, services: EditorOperationServices): void {
  let nav = getCursorNavigatorAndValidate(state, services);

  switch (nav.classifyCurrentPosition()) {
    case PositionClassification.Grapheme:
      ifLet(Chain.getParentAndTipIfPossible(nav.chain), ([parent, tip]) => {
        if (!Node.containsText(parent.node)) {
          return false;
        }

        let index = PathPart.getIndex(tip.pathPart);
        if (state.cursor.affinity === CursorAffinity.Before) {
          index--;
        }

        if (index !== -1) {
          if (parent.node.text.length === 1 && Node.isInlineText(parent.node)) {
            // In this case we are about to remove the last character in an
            // inline text In this case, we prefer to delete the inline text.
            const navPrime = nav.toNodeNavigator();
            navPrime.navigateToParent();
            deleteNode(navPrime, services);

            nav = refreshNavigator(nav);
            nav.navigateToParentUnchecked();
            nav.navigateToPrecedingSiblingUnchecked();
            nav.navigateToLastDescendantCursorPosition();
          } else {
            castDraft(parent.node).text.splice(index, 1);
            // Would it be better to just try jumping to something?
            nav.navigateToPrecedingCursorPosition();
            // This fixes a bug where we navigate back but the only thing that changes is the CursorAffinity
            if (
              nav.tip.pathPart &&
              PathPart.getIndex(nav.tip.pathPart) === index &&
              nav.cursor.affinity === CursorAffinity.Before &&
              nav.toNodeNavigator().navigateToPrecedingSibling()
            ) {
              nav.navigateToPrecedingCursorPosition();
            }
          }
        } else {
          // In this case we are deleting the character behind this one. This
          // doesn't need to do anything in the case of non-InlineText's but for
          // InlineTexts it can try to delete the actual prior text. But because
          // of the way the cursor navigator works this genreally won't happen
          // because it almost always prefers after affinity for graphemes except
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
      deleteNode(nav.toNodeNavigator(), services);
      nav = refreshNavigator(nav);
      nav.navigateToPrecedingSiblingUnchecked();
      nav.navigateToLastDescendantCursorPosition();
      break;
    case PositionClassification.BeforeInBetweenInsertionPoint:
    case PositionClassification.AfterInBetweenInsertionPoint:
      nav.navigateToPrecedingCursorPosition();
      break;
  }
  state.cursor = castDraft(nav.cursor);
  clearSelection(state);
  resetCursorMovementHints(state);
}

export function deleteSelection(state: immer.Draft<EditorState>, services: EditorOperationServices): void {
  if (!state.selection || !state.selectionAnchor) {
    throw new OperationError(OperationErrorCode.SelectionRequired);
  }

  {
    const elementsToDelete = Range.getChainsCoveringRange(state.document, state.selection);
    elementsToDelete.reverse();
    const nav = new NodeNavigator(state.document);
    for (const chain of elementsToDelete) {
      nav.navigateTo(Chain.getPath(chain));
      deleteNode(nav, services);
    }
  }

  // This navigator is positioned on the place we will leave the selection after the deletion
  {
    const nav = new CursorNavigator(state.document);
    nav.navigateTo(state.selection.from, CursorAffinity.Before);
    state.cursor = castDraft(nav.cursor);
  }
  clearSelection(state);
  resetCursorMovementHints(state);
}

function deleteNode(nodeNavigator: NodeNavigator, services: EditorOperationServices): void {
  const node = nodeNavigator.tip.node;
  const parent = nodeNavigator.parent;
  const pathPart = nodeNavigator.tip.pathPart;

  if (!parent || !pathPart) {
    return;
  }
  const kids = Node.getChildren(parent.node);
  const kidIndex = PathPart.getIndex(pathPart);

  if (!kids) {
    return;
  }

  // Unregister all child nodes and the node itself
  if (!Node.isGrapheme(node)) {
    nodeNavigator.traverseDescendants((node) => services.tracking.unregister(node), {
      skipGraphemes: true,
    });
    services.tracking.unregister(node);
  }

  castDraft(kids).splice(kidIndex, 1);
}
