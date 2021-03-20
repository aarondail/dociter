import * as immer from "immer";

import { Path, PathString } from "../../basic-traversal";
import { CursorAffinity, CursorNavigator } from "../../cursor";
import { EditorState } from "../editor";

import { OperationError, OperationErrorCode } from "./error";
import { getCursorNavigatorAndValidate } from "./utils";

const castDraft = immer.castDraft;

export function moveBack(state: immer.Draft<EditorState>): void {
  const nav = getCursorNavigatorAndValidate(state);
  if (nav.navigateToPrecedingCursorPosition()) {
    state.cursor = castDraft(nav.cursor);
  }
}

export function moveForward(state: immer.Draft<EditorState>): void {
  const nav = getCursorNavigatorAndValidate(state);
  if (nav.navigateToNextCursorPosition()) {
    state.cursor = castDraft(nav.cursor);
  }
}

export const jumpTo = (path: PathString | Path, affinity: CursorAffinity) => (
  state: immer.Draft<EditorState>
): void => {
  const nav = new CursorNavigator(state.document);
  if (nav.navigateTo(path, affinity)) {
    state.cursor = castDraft(nav.cursor);
  } else {
    throw new OperationError(OperationErrorCode.INVALID_OPERATION_ARGUMENT, "path is invalid");
  }
};
