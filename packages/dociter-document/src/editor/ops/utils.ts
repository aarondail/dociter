import lodash from "lodash";

import { Cursor, CursorNavigator } from "../../cursor";
import * as Models from "../../models";

import { OperationError, OperationErrorCode } from "./error";

export function getCursorNavigatorAndValidate(document: Models.Document, cursor: Cursor): CursorNavigator {
  const nav = new CursorNavigator(document);
  if (!nav.navigateTo(cursor)) {
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
