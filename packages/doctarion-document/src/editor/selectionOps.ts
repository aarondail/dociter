import * as immer from "immer";

import { NodeNavigator, Path, PathString } from "../basic-traversal";
import { Cursor, CursorAffinity, CursorNavigator } from "../cursor";
import { Range } from "../ranges";

import { createOperation } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { EditorState, SelectionAnchor } from "./state";
import { resetCursorMovementHints } from "./utils";

const castDraft = immer.castDraft;

export const select = createOperation(
  "selection/create",
  (
    state: immer.Draft<EditorState>,
    _,
    payload: {
      from: PathString | Path;
      to: PathString | Path;
      anchor?: SelectionAnchor;
    }
  ): void => {
    const { from, to, anchor } = payload;
    const nav = new NodeNavigator(state.document);
    if (!nav.navigateTo(from)) {
      throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "from is invalid");
    }
    const fromPrime = nav.path;
    if (!nav.navigateTo(to)) {
      throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "to is invalid");
    }
    const toPrime = nav.path;

    state.selection = castDraft(new Range(fromPrime, toPrime));
    state.selectionAnchor = anchor || SelectionAnchor.End;

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
      state.cursor = castDraft(new Cursor(fromPrime, CursorAffinity.Before));
    }

    resetCursorMovementHints(state);
  }
);

export function clearSelection(state: immer.Draft<EditorState>): void {
  state.selection = undefined;
  state.selectionAnchor = undefined;
}
