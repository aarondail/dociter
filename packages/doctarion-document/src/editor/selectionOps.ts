import * as immer from "immer";

import { NodeNavigator, Path, PathString } from "../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation } from "../cursor";
import { Range } from "../ranges";

import { createCoreOperation } from "./coreOperations";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { EditorState } from "./state";

const castDraft = immer.castDraft;

export const select = createCoreOperation(
  "selection/create",
  (
    state: immer.Draft<EditorState>,
    _,
    payload: {
      from: PathString | Path;
      fromOrientation?: CursorOrientation;
      to: PathString | Path;
      toOrientation?: CursorOrientation;
    }
  ): void => {
    const { from, fromOrientation, to, toOrientation } = payload;
    const nav = new NodeNavigator(state.document);
    if (!nav.navigateTo(from)) {
      throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "from is invalid");
    }
    const fromPrime = nav.path;
    if (!nav.navigateTo(to)) {
      throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "to is invalid");
    }
    const toPrime = nav.path;

    state.interactors[0].mainCursor = castDraft(new Cursor(fromPrime, fromOrientation ?? CursorOrientation.On));
    state.interactors[0].selectionAnchorCursor = castDraft(new Cursor(toPrime, toOrientation ?? CursorOrientation.On));
    // TODO maybe validate cursor positions?
    state.interactors[0].visualLineMovementHorizontalAnchor = undefined;
  }
);

// export function clearSelection(state: immer.Draft<EditorState>): void {
//   state.selection = undefined;
//   state.selectionAnchor = undefined;
// }
