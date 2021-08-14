import * as immer from "immer";

import { CursorNavigator, CursorPosition } from "../cursor";
import { Interactor, InteractorId, InteractorStatus } from "../editor";

import { createCoreOperation } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";

const castDraft = immer.castDraft;

export const addInteractor = createCoreOperation<
  {
    at: CursorPosition;
    selectionAnchor?: CursorPosition;
    status?: InteractorStatus;
    focused?: boolean;
  },
  InteractorId | undefined
>("interactor/add", (state, services, { at, status, selectionAnchor, focused }): InteractorId | undefined => {
  let mainCursor = CursorPosition.toCursor(at);
  const nav = new CursorNavigator(state.document, services.layout);
  if (!nav.navigateTo(mainCursor)) {
    throw new EditorOperationError(EditorOperationErrorCode.InvalidCursorPosition, "mainCursor is not a valid cursor");
  }
  mainCursor = nav.cursor;

  let selectionAnchorCursor = selectionAnchor && CursorPosition.toCursor(selectionAnchor);
  if (selectionAnchorCursor) {
    if (!nav.navigateTo(selectionAnchorCursor)) {
      throw new EditorOperationError(
        EditorOperationErrorCode.InvalidCursorPosition,
        "selectionAnchorCursor is not a valid cursor"
      );
    }
    selectionAnchorCursor = nav.cursor;
  }

  const id = services.idGenerator.generateId("INTERACTOR");
  const interactor = new Interactor(id, mainCursor, status, selectionAnchorCursor);
  if (services.interactors.add(interactor)) {
    if (focused) {
      state.focusedInteractorId = id;
    }
    return id;
  }

  return undefined;
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
  to?: CursorPosition;
  selectionAnchor?: CursorPosition;
  status?: InteractorStatus;
  focused?: boolean;
}>("interactor/update", (state, services, payload): void => {
  const { id, ...updates } = payload;
  const interactor = state.interactors[id];
  if (!interactor) {
    throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "index is invalid");
  }

  const nav = new CursorNavigator(state.document, services.layout);
  if (updates.to) {
    const mainCursor = CursorPosition.toCursor(updates.to);
    if (!nav.navigateTo(mainCursor)) {
      throw new EditorOperationError(
        EditorOperationErrorCode.InvalidCursorPosition,
        "mainCursor is not a valid cursor"
      );
    }
    interactor.mainCursor = castDraft(nav.cursor);
    interactor.visualLineMovementHorizontalAnchor = undefined;
  }

  if ("selectionAnchor" in updates) {
    if (updates.selectionAnchor) {
      const selectionAnchorCursor = CursorPosition.toCursor(updates.selectionAnchor);
      if (!nav.navigateTo(selectionAnchorCursor)) {
        throw new EditorOperationError(
          EditorOperationErrorCode.InvalidCursorPosition,
          "selectionAnchorCursor is not a valid cursor"
        );
      }
      interactor.selectionAnchorCursor = castDraft(nav.cursor);
    } else {
      interactor.selectionAnchorCursor = undefined;
    }
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
