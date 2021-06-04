import * as immer from "immer";

import { Cursor, CursorNavigator } from "../cursor";

import { Interactor, InteractorId, InteractorStatus } from "./interactor";
import { createCoreOperation } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";

const castDraft = immer.castDraft;

export const addInteractor = createCoreOperation<{
  mainCursor: Cursor;
  selectionAnchorCursor?: Cursor;
  status?: InteractorStatus;
  focused?: boolean;
}>("interactor/add", (state, services, { mainCursor, status, selectionAnchorCursor, focused }): void => {
  const nav = new CursorNavigator(state.document, services.layout);
  if (!nav.navigateTo(mainCursor)) {
    throw new EditorOperationError(EditorOperationErrorCode.InvalidCursorPosition, "mainCursor is not a valid cursor");
  }

  if (selectionAnchorCursor) {
    if (!nav.navigateTo(selectionAnchorCursor)) {
      throw new EditorOperationError(
        EditorOperationErrorCode.InvalidCursorPosition,
        "selectionAnchorCursor is not a valid cursor"
      );
    }
  }

  const id = services.idGenerator.generateId("INTERACTOR");
  const interactor = new Interactor(id, mainCursor, status, selectionAnchorCursor);
  services.interactors.add(interactor);
  if (focused) {
    state.focusedInteractorId = id;
  }
  // TODO return id;
});

export const removeInteractor = createCoreOperation<{ id: InteractorId }>(
  "interactor/remove",
  (state, services, { id }): void => {
    services.interactors.delete(id);
    if (state.focusedInteractorId === id) {
      state.focusedInteractorId = undefined;
    }
  }
);

export const updateInteractor = createCoreOperation<{
  id: InteractorId;
  mainCursor?: Cursor;
  selectionAnchorCursor?: Cursor;
  status?: InteractorStatus;
  focused?: boolean;
}>("interactor/update", (state, services, payload): void => {
  const { id, ...updates } = payload;
  const interactor = state.interactors[id];
  if (!interactor) {
    throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "index is invalid");
  }

  const nav = new CursorNavigator(state.document, services.layout);
  if (updates.mainCursor) {
    if (!nav.navigateTo(updates.mainCursor)) {
      throw new EditorOperationError(
        EditorOperationErrorCode.InvalidCursorPosition,
        "mainCursor is not a valid cursor"
      );
    }
    interactor.mainCursor = castDraft(updates.mainCursor);
    interactor.visualLineMovementHorizontalAnchor = undefined;
  }

  if ("selectionAnchorCursor" in updates) {
    if (updates.selectionAnchorCursor) {
      if (!nav.navigateTo(updates.selectionAnchorCursor)) {
        throw new EditorOperationError(
          EditorOperationErrorCode.InvalidCursorPosition,
          "selectionAnchorCursor is not a valid cursor"
        );
      }
    }
    interactor.selectionAnchorCursor = castDraft(updates.selectionAnchorCursor);
  }

  if (updates.status) {
    interactor.status = updates.status;
  }

  services.interactors.notifyUpdated(id);

  if (updates.focused !== undefined) {
    if (updates.focused) {
      state.focusedInteractorId = id;
    } else {
      if (state.focusedInteractorId === id) {
        state.focusedInteractorId = undefined;
      }
    }
  }
});
