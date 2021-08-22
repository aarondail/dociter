import { InteractorId, InteractorStatus } from "./interactor";
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
  const interactor = services.interactors.add({
    to: at,
    status: status || InteractorStatus.Active,
    selectTo,
    focused,
    name,
  });
  return interactor?.id;
});

export const removeInteractor = createCoreOperation<{ id: InteractorId }>(
  "interactor/remove",
  (state, services, { id }): void => {
    services.interactors.delete(id);
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
  services.interactors.updateInteractor(id, updates);
});
