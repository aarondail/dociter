import * as immer from "immer";

import { Path, PathString } from "../../basic-traversal";
import { CursorAffinity, CursorNavigator } from "../../cursor";
import { EditorState } from "../editor";

import { OperationError, OperationErrorCode } from "./error";
import { clearSelection } from "./selectionOps";
import { getCursorNavigatorAndValidate } from "./utils";

const castDraft = immer.castDraft;

export function moveBack(state: immer.Draft<EditorState>): void {
  const nav = getCursorNavigatorAndValidate(state);
  if (nav.navigateToPrecedingCursorPosition()) {
    state.cursor = castDraft(nav.cursor);
    clearSelection(state);
  }
}

export function moveForward(state: immer.Draft<EditorState>): void {
  const nav = getCursorNavigatorAndValidate(state);
  if (nav.navigateToNextCursorPosition()) {
    state.cursor = castDraft(nav.cursor);
    clearSelection(state);
  }
}

export const jumpTo = (path: PathString | Path, affinity: CursorAffinity) => (
  state: immer.Draft<EditorState>
): void => {
  const nav = new CursorNavigator(state.document);
  if (nav.navigateTo(path, affinity)) {
    state.cursor = castDraft(nav.cursor);
    clearSelection(state);
  } else {
    throw new OperationError(OperationErrorCode.InvalidArgument, "path is invalid");
  }
};
