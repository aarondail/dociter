import { CursorNavigator } from "../cursor";
import { EditorState } from "../editor";

import { OperationError, OperationErrorCode } from "./error";
import { EditorServices } from "./services";

export function ifLet<C, T>(a: C | undefined, callback: (a: C) => T): T | undefined {
  if (a !== undefined) {
    return callback(a);
  }
  return undefined;
}

export function getCursorNavigatorAndValidate(state: EditorState, services: EditorServices): CursorNavigator {
  const nav = new CursorNavigator(state.document, services.layout);
  if (!nav.navigateTo(state.cursor)) {
    throw new OperationError(OperationErrorCode.InvalidCursorPosition);
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
