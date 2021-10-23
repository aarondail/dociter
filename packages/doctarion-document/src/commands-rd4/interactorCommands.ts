import { InteractorId, InteractorStatus } from "../working-document-rd4";

import { InteractorInputPosition } from "./payloads";
import { coreCommand } from "./types";
import { CommandUtils } from "./utils";

export const addInteractor = coreCommand<
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
    mainAnchor: CommandUtils.getAnchorParametersFromInteractorInputPosition(state, at),
    status: status || InteractorStatus.Active,
    selectionAnchor: selectTo
      ? CommandUtils.getAnchorParametersFromInteractorInputPosition(state, selectTo)
      : undefined,
    name,
  });

  const dedupeIds = CommandUtils.dedupeInteractors(state);
  if (dedupeIds && dedupeIds.includes(interactor.id)) {
    return undefined;
  }

  if (focused) {
    state.setFocusedInteractor(interactor.id);
  }

  return interactor.id;
});

export const removeInteractor = coreCommand<{ id: InteractorId }>(
  "interactor/remove",
  (state, services, { id }): void => {
    state.deleteInteractor(id);
  }
);

export const updateInteractor = coreCommand<{
  id: InteractorId;
  to?: InteractorInputPosition;
  selectTo?: InteractorInputPosition;
  status?: InteractorStatus;
  // focused?: boolean;
  name?: string;
}>("interactor/update", (state, services, payload): void => {
  const { id, ...updates } = payload;

  state.updateInteractor(id, {
    ...updates,
    mainAnchor: updates.to ? CommandUtils.getAnchorParametersFromInteractorInputPosition(state, updates.to) : undefined,
    selectionAnchor: updates.selectTo
      ? CommandUtils.getAnchorParametersFromInteractorInputPosition(state, updates.selectTo)
      : undefined,
  });
});
