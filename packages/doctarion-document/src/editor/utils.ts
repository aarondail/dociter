import { Draft, castDraft } from "immer";

import { CursorNavigator } from "../cursor";
import { EditorState, MovementTargetPayload } from "../editor";
import { Interactor, InteractorId, InteractorStatus, InteractorUpdateParams } from "../interactor";
import { SimpleComparison } from "../miscUtils";

import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { EditorOperationServices } from "./services";
import { InteractorTarget } from "./target";

export function ifLet<C, T>(a: C | undefined, callback: (a: C) => T): T | undefined {
  if (a !== undefined) {
    return callback(a);
  }
  return undefined;
}

export function getCursorNavigatorAndValidate(
  state: EditorState,
  services: EditorOperationServices,
  interactorId: InteractorId
): CursorNavigator {
  const nav = new CursorNavigator(state.document, services.layout);
  const interactor = state.interactors.byId[Object.keys(state.interactors.byId)[0]]; //interactorId];
  if (!interactor) {
    throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "no interactor found with the given id");
  } else if (!nav.navigateTo(interactor.mainCursor)) {
    throw new EditorOperationError(EditorOperationErrorCode.InvalidCursorPosition);
  }
  return nav;
}

// export function getInteractorsAndCursorNavigatorsForMovementTargetPayload(
//   state: Draft<EditorState>,
//   services: EditorOperationServices,
//   payload: MovementTargetPayload
// ): { navigator: CursorNavigator; interactor: Interactor }[] {
//   const interactorIds = selectInteractorIdsForPayload(payload, state);

//   return interactorIds.map((id) => {
//     const interactor = state.interactors.byId[id];
//     const nav = new CursorNavigator(state.document, services.layout);
//     if (!nav.navigateTo(interactor.mainCursor)) {
//       throw new EditorOperationError(
//         EditorOperationErrorCode.InvalidCursorPosition,
//         `Interactor ${interactor.id} had an invalid mainCursor position.`
//       );
//     }
//     return { interactor, navigator: nav };
//   });
// }

export function forEachInteractorInPayloadDo(
  state: Draft<EditorState>,
  services: EditorOperationServices,
  payload: MovementTargetPayload,
  updateFn: (interactor: Interactor, navigator: CursorNavigator) => InteractorUpdateParams | undefined
): void {
  const interactorIds = selectOrderedInteractorIdsForPayload(payload, state);

  const updates: [InteractorId, InteractorUpdateParams][] = [];
  interactorIds.forEach((id) => {
    const interactor = state.interactors.byId[id];
    const nav = new CursorNavigator(state.document, services.layout);
    if (!nav.navigateTo(interactor.mainCursor)) {
      throw new EditorOperationError(
        EditorOperationErrorCode.InvalidCursorPosition,
        `Interactor ${interactor.id} had an invalid mainCursor position.`
      );
    }

    const updatedParams = updateFn(interactor, nav);
    if (updatedParams) {
      updates.push([id, updatedParams]);
    }
  });

  if (updates.length > 0) {
    state.interactors = castDraft(state.interactors.updateInteractors(updates));
    if (state.interactors.ordered.length > 1) {
      dedupeInteractors(state);
    }
  }
}

/**
 * Used after the document has been updated in an operation to make sure the
 * element chain of the document has updated elements.
 */
export function refreshNavigator(nav: CursorNavigator): CursorNavigator {
  const n = new CursorNavigator(nav.document);
  n.navigateToUnchecked(nav.cursor);
  return n;
}

/**
 * There definitely could be more situations in which we want to dedupe
 * interactors, but for right now we only dedupe interactors that ARENT a
 * selection AND have the same status AND their mainCursor is equal.
 *
 * The logic of this function relies on the fact that we have an ordered array
 * of interactors, ordered by their forward cursor (which, in the case of non
 * selection interactors is thier mainCursor)
 */
function dedupeInteractors(state: Draft<EditorState>) {
  if (state.interactors.count <= 1) {
    return;
  }
  const idsToDelete: InteractorId[] = [];
  let newFocusId: InteractorId | undefined = undefined;
  let priorActive: Interactor | undefined = undefined;
  let priorInactive: Interactor | undefined = undefined;
  state.interactors.ordered.forEach((id) => {
    const interactor = state.interactors.byId[id];
    // Only deal with interactors that are not selections
    if (interactor.isSelection) {
      return;
    }

    if (interactor.status === InteractorStatus.Active) {
      if (!priorActive) {
        priorActive = interactor;
      } else {
        if (priorActive.mainCursor.compareTo(interactor.mainCursor) === SimpleComparison.Equal) {
          idsToDelete.push(interactor.id);
          if (state.interactors.focusedId === interactor.id) {
            newFocusId = priorActive.id;
          }
        }
      }
    } else {
      if (!priorInactive) {
        priorInactive = interactor;
      } else {
        if (priorInactive.mainCursor.compareTo(interactor.mainCursor) === SimpleComparison.Equal) {
          idsToDelete.push(interactor.id);
          if (state.interactors.focusedId === interactor.id) {
            newFocusId = priorInactive.id;
          }
        }
      }
    }
  });

  if (idsToDelete.length > 0) {
    state.interactors = castDraft(state.interactors.deleteInteractors(idsToDelete));
    if (newFocusId) {
      state.interactors = castDraft(state.interactors.setFocused(newFocusId));
    }
  }
}

/**
 * The returned ids are in the exact same order as they appear in the
 * state.interactors.ordered list.
 */
function selectOrderedInteractorIdsForPayload(payload: MovementTargetPayload, state: Draft<EditorState>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payloadTargetUntyped: any = payload.target;

  let interactorIds: InteractorId[] = [];
  if (payload === undefined) {
    if (state.interactors.focusedId) {
      interactorIds.push(state.interactors.focusedId);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  } else if (payloadTargetUntyped.interactorId !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    interactorIds.push(payloadTargetUntyped.interactorId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  } else if (payloadTargetUntyped.interactorIds !== undefined) {
    interactorIds = state.interactors.ordered.filter((x: InteractorId) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      payloadTargetUntyped.interactorIds.includes(x)
    );
  } else {
    switch (payload.target) {
      case InteractorTarget.All:
        interactorIds = state.interactors.ordered;
        break;
      case InteractorTarget.AllActive:
        for (let i = 0; i < state.interactors.ordered.length; i++) {
          const id = state.interactors.ordered[i];
          const interactor = state.interactors.byId[id];
          if (interactor.status === InteractorStatus.Active) {
            interactorIds.push(id);
          }
        }
        break;
      case InteractorTarget.Focused:
        if (state.interactors.focusedId) {
          interactorIds.push(state.interactors.focusedId);
        }
        break;
    }
  }
  return interactorIds;
}
