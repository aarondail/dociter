import * as immer from "immer";

import { CursorNavigator, CursorPosition } from "../cursor";

import { Anchor } from "./anchor";
import { Interactor, InteractorId, InteractorStatus } from "./interactor";
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
  const mainCursor = CursorPosition.toCursor(at);
  const nav = new CursorNavigator(state.document, services.layout);
  if (!nav.navigateTo(mainCursor)) {
    throw new EditorOperationError(EditorOperationErrorCode.InvalidCursorPosition, "mainCursor is not a valid cursor");
  }
  const main = nav.clone();

  let sa;
  const selectionAnchorCursor = selectionAnchor && CursorPosition.toCursor(selectionAnchor);
  if (selectionAnchorCursor) {
    if (!nav.navigateTo(selectionAnchorCursor)) {
      throw new EditorOperationError(
        EditorOperationErrorCode.InvalidCursorPosition,
        "selectionAnchorCursor is not a valid cursor"
      );
    }
    sa = nav;
  }

  const id = services.idGenerator.generateId("INTERACTOR");
  const interactor = new Interactor(
    id,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    Anchor.fromCursorNavigator(main)!,
    status,
    sa && Anchor.fromCursorNavigator(sa)
  );
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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    interactor.mainAnchor = castDraft(Anchor.fromCursorNavigator(nav))!;
    interactor.lineMovementHorizontalVisualAnchor = undefined;
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
      interactor.selectionAnchor = Anchor.fromCursorNavigator(nav);
    } else {
      interactor.selectionAnchor = undefined;
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
