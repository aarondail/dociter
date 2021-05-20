import { Draft } from "immer";
import lodash from "lodash";

import { CursorNavigator } from "../cursor";
import { EditorState, MovementTargetPayload } from "../editor";
import { Interactor, InteractorId, InteractorStatus } from "../interactor";

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
  const interactor = state.interactors.byId[interactorId];
  if (!interactor) {
    throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "no interactor found with the given id");
  } else if (!nav.navigateTo(interactor.mainCursor)) {
    throw new EditorOperationError(EditorOperationErrorCode.InvalidCursorPosition);
  }
  return nav;
}

export function getInteractorsAndCursorNavigatorsForMovementTargetPayload(
  state: Draft<EditorState>,
  services: EditorOperationServices,
  payload: MovementTargetPayload
): { navigator: CursorNavigator; interactor: Interactor }[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payloadUntyped: any = payload;
  let interactorIds: InteractorId[] = [];
  if (payload === undefined) {
    if (state.interactors.focusedId) {
      interactorIds.push(state.interactors.focusedId);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  } else if (payloadUntyped.interactorIndex !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    interactorIds.push(payloadUntyped.interactorIndex);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  } else if (payloadUntyped.interactorIndecies !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    interactorIds = payloadUntyped.interactorIndecies;
  } else {
    switch (payload) {
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

  return interactorIds.map((id) => {
    const interactor = state.interactors.byId[id];
    const nav = new CursorNavigator(state.document, services.layout);
    if (!nav.navigateTo(interactor.mainCursor)) {
      throw new EditorOperationError(
        EditorOperationErrorCode.InvalidCursorPosition,
        `Interactor ${interactor.id} had an invalid mainCursor position.`
      );
    }
    return { interactor, navigator: nav };
  });
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
