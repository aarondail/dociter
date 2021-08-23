import { InteractorId, InteractorStatus } from "../working-document";

import { createCoreOperation } from "./operation";
import { InteractorInputPosition } from "./utils";

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
  const interactor = state.addInteractor({
    at: services.interactors.convertInteractorInputPositionToAnchorPosition(at),
    status: status || InteractorStatus.Active,
    selectTo: selectTo ? services.interactors.convertInteractorInputPositionToAnchorPosition(selectTo) : undefined,
    name,
  });

  const dedupeIds = services.interactors.dedupe();
  if (dedupeIds && dedupeIds.includes(interactor.id)) {
    return undefined;
  }

  if (focused) {
    state.focusedInteractorId = interactor.id;
  }

  return interactor.id;
});

export const removeInteractor = createCoreOperation<{ id: InteractorId }>(
  "interactor/remove",
  (state, services, { id }): void => {
    state.deleteInteractor(id);
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

  state.updateInteractor(id, {
    ...updates,
    to: updates.to ? services.interactors.convertInteractorInputPositionToAnchorPosition(updates.to) : undefined,
    selectTo: updates.selectTo
      ? services.interactors.convertInteractorInputPositionToAnchorPosition(updates.selectTo)
      : undefined,
  });
});
