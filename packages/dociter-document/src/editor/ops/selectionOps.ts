import * as immer from "immer";

import { NodeNavigator, Path, PathString } from "../../basic-traversal";
import { Cursor, CursorAffinity, CursorNavigator } from "../../cursor";
import { Range } from "../../ranges";
import { EditorState, SelectionAnchor } from "../editor";

import { OperationError, OperationErrorCode } from "./error";

const castDraft = immer.castDraft;

export const select = (
  from: PathString | Path,
  to: PathString | Path,
  anchor: SelectionAnchor = SelectionAnchor.End
) => (state: immer.Draft<EditorState>): void => {
  const nav = new NodeNavigator(state.document);
  if (!nav.navigateTo(from)) {
    throw new OperationError(OperationErrorCode.InvalidArgument, "from is invalid");
  }
  const fromPrime = nav.path;
  if (!nav.navigateTo(to)) {
    throw new OperationError(OperationErrorCode.InvalidArgument, "to is invalid");
  }
  const toPrime = nav.path;

  state.selection = castDraft(Range.new(fromPrime, toPrime));
  state.selectionAnchor = anchor;

  if (state.selectionAnchor === SelectionAnchor.End) {
    const nav2 = new CursorNavigator(state.document);
    if (!nav2.navigateTo(toPrime, CursorAffinity.After)) {
      throw new Error("Unexpectedly could not navigate a cursor to the selection's end.");
    }
    state.cursor = castDraft(nav2.cursor);
  } else {
    const nav2 = new CursorNavigator(state.document);
    if (!nav2.navigateTo(fromPrime, CursorAffinity.Before)) {
      throw new Error("Unexpectedly could not navigate a cursor to the selection's end.");
    }
    state.cursor = castDraft(Cursor.new(fromPrime, CursorAffinity.Before));
  }
};

export function clearSelection(state: immer.Draft<EditorState>): void {
  state.selection = undefined;
  state.selectionAnchor = undefined;
}
