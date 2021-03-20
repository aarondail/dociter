import { CursorNavigator } from "../../cursor";
import { EditorState } from "../editor";

import { OperationError, OperationErrorCode } from "./error";

export function getCursorNavigatorAndValidate(state: EditorState): CursorNavigator {
  const nav = new CursorNavigator(state.document);
  if (!nav.navigateTo(state.cursor)) {
    throw new OperationError(OperationErrorCode.INVALID_CURSOR_POSITION);
  }
  return nav;
}

/**
 * Used after the document has been updated in an operation to make sure the
 * element chain of the document has updated elements.
 */
export function refreshNavigator(nav: CursorNavigator): CursorNavigator {
  const n = new CursorNavigator(nav.document);
  n.navigateToUnchecked(nav.cursor);
  return n;
}
