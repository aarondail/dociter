import { Interactor, InteractorId, InteractorStatus } from "./interactor";
import { createCoreOperation } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { InteractorInputPosition, convertInteractorInputPositionToAnchor } from "./utils";

export const addInteractor = createCoreOperation<
  {
    at: InteractorInputPosition;
    selectTo?: InteractorInputPosition;
    status?: InteractorStatus;
    focused?: boolean;
    name?: string;
  },
  InteractorId | undefined
>("interactor/add", (state, services, { at, status, selectTo, focused, name }): InteractorId | undefined => {
  const mainAnchor = convertInteractorInputPositionToAnchor(state, services, at);

  let selectionAnchor;
  if (selectTo) {
    selectionAnchor = convertInteractorInputPositionToAnchor(state, services, selectTo);
  }

  const id = services.idGenerator.generateId("INTERACTOR");
  const interactor = new Interactor(id, mainAnchor, status, selectionAnchor, undefined, name);
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
  to?: InteractorInputPosition;
  selectTo?: InteractorInputPosition;
  status?: InteractorStatus;
  focused?: boolean;
  name?: string;
}>("interactor/update", (state, services, payload): void => {
  const { id, ...updates } = payload;
  const interactor = state.interactors[id];
  if (!interactor) {
    throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "index is invalid");
  }

  if (updates.to) {
    interactor.mainAnchor = convertInteractorInputPositionToAnchor(state, services, updates.to);
    interactor.lineMovementHorizontalVisualAnchor = undefined;
  }

  if ("selectTo" in updates) {
    if (updates.selectTo) {
      interactor.selectionAnchor = convertInteractorInputPositionToAnchor(state, services, updates.selectTo);
    } else {
      interactor.selectionAnchor = undefined;
    }
  }

  if ("name" in updates) {
    interactor.name = updates.name;
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
