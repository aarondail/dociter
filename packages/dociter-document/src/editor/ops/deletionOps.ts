import * as immer from "immer";

import { Chain, ChainLink, ChainLinkNotFirst, Node, PathPart } from "../../basic-traversal";
import { CursorAffinity, PositionClassification } from "../../cursor";
import { EditorState } from "../editor";

import { getCursorNavigatorAndValidate, ifLet, refreshNavigator } from "./utils";

const castDraft = immer.castDraft;

export function deleteBackwards(state: immer.Draft<EditorState>): void {
  let nav = getCursorNavigatorAndValidate(state);

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
}

// deleteSelection(state: immer.Draft<EditorState>): void {
//   const c = state.interloc;

//   if (c.kind === DocumentInteractionLocationKind.CURSOR) {
//     throw new OperationError(OperationErrorCode.OPERATION_NOT_POSSIBLE_ON_CURSOR);
//   }

//   // This navigator is positioned on the place we will leave the selection after the deletion
//   const nav = new DocumentElementNavigator(state.document);
//   nav.navigateTo(c.selection[0]);
//   nav.navigateBackwardsInDfs();

//   const elementsToDelete = getMostAncestorialElementsInRange(state.document, c.selection[0], c.selection[1]);
//   elementsToDelete.reverse();
//   for (const chain of elementsToDelete) {
//     ifLet(getParentAndTipIfPossible(chain), ([parent, tip]) => {
//       deleteChild(parent, tip);
//     });
//   }

//   state.interloc = castDraft(DocumentSelection.new(nav.path, nav.path, DocumentSelectionAnchor.START));
// },

// TODO deleteForward (for windows) (and linux?)

function deleteChild(parent: ChainLink, tip: ChainLinkNotFirst): void {
  const kids = Node.getChildren(parent.node);
  const kidIndex = PathPart.getIndex(tip.pathPart);

  if (!kids) {
    return;
  }
  castDraft(kids).splice(kidIndex, 1);
}
