import * as immer from "immer";

import { Chain, ChainLink, ChainLinkNotFirst, Node, PathPart } from "../basic-traversal";
import { CursorAffinity, CursorNavigator, PositionClassification } from "../cursor";
import { Range } from "../ranges";

import { resetCursorMovementHints } from "./cursorOps";
import { EditorState } from "./editor";
import { OperationError, OperationErrorCode } from "./error";
import { clearSelection } from "./selectionOps";
import { EditorServices } from "./services";
import { getCursorNavigatorAndValidate, ifLet, refreshNavigator } from "./utils";

const castDraft = immer.castDraft;

export function deleteBackwards(state: immer.Draft<EditorState>, services: EditorServices): void {
  let nav = getCursorNavigatorAndValidate(state, services);

  switch (nav.classifyCurrentPosition()) {
    case PositionClassification.CodePoint:
      ifLet(Chain.getGrandParentToTipIfPossible(nav.chain), ([grandParent, parent, tip]) => {
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
            deleteChild(grandParent, parent);

            nav = refreshNavigator(nav);
            nav.navigateToParentUnchecked();
            nav.navigateToPrecedingSiblingUnchecked();
            nav.navigateToLastDescendantCursorPosition();
          } else {
            castDraft(parent.node).text.splice(index, 1);
            nav.navigateToPrecedingCursorPosition();
          }
        } else {
          // In this case we are deleting the character behind this one. This
          // doesn't need to do anything in the case of non-InlineText's but for
          // InlineTexts it can try to delete the actual prior text. But because
          // of the way the cursor navigator works this genreally won't happen
          // because it almost always prefers after affinity for code points except
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
      ifLet(Chain.getParentAndTipIfPossible(nav.chain), ([parent, tip]) => {
        deleteChild(parent, tip);
        nav = refreshNavigator(nav);
        nav.navigateToPrecedingSiblingUnchecked();
        nav.navigateToLastDescendantCursorPosition();
      });
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

export function deleteSelection(state: immer.Draft<EditorState>): void {
  if (!state.selection || !state.selectionAnchor) {
    throw new OperationError(OperationErrorCode.SelectionRequired);
  }

  // This navigator is positioned on the place we will leave the selection after the deletion
  const nav = new CursorNavigator(state.document);
  nav.navigateTo(state.selection.from, CursorAffinity.Before);

  const elementsToDelete = Range.getChainsCoveringRange(state.document, state.selection);
  elementsToDelete.reverse();
  for (const chain of elementsToDelete) {
    ifLet(Chain.getParentAndTipIfPossible(chain), ([parent, tip]) => {
      deleteChild(parent, tip);
    });
  }

  state.cursor = castDraft(nav.cursor);
  clearSelection(state);
  resetCursorMovementHints(state);
}

function deleteChild(parent: ChainLink, tip: ChainLinkNotFirst): void {
  const kids = Node.getChildren(parent.node);
  const kidIndex = PathPart.getIndex(tip.pathPart);

  if (!kids) {
    return;
  }
  castDraft(kids).splice(kidIndex, 1);
}
