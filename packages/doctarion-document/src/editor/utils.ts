import { Draft, castDraft } from "immer";

import { Cursor, CursorNavigator } from "../cursor";
import { EditorState, MovementTargetPayload } from "../editor";
import { Interactor, InteractorId, InteractorStatus } from "../interactor";
import { SimpleComparison } from "../miscUtils";

import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { EditorOperationServices } from "./services";
import { InteractorTarget, NonSelectionTargetPayload } from "./target";

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

/**
 * There definitely could be more situations in which we want to dedupe
 * interactors, but for right now we only dedupe interactors that ARENT a
 * selection AND have the same status AND their mainCursor is equal.
 *
 * The logic of this function relies on the fact that we have an ordered array
 * of interactors, ordered by their forward cursor (which, in the case of non
 * selection interactors is thier mainCursor)
 */
export function dedupeInteractors(state: Draft<EditorState>): void {
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
 * Used after the document has been updated in an operation to make sure the
 * element chain of the document has updated elements.
 */
export function refreshNavigator(nav: CursorNavigator): CursorNavigator {
  const n = new CursorNavigator(nav.document);
  n.navigateToUnchecked(nav.cursor);
  return n;
}

/**
 * The returned interactors (if there are interactors) are in the exact same
 * order as they appear in the interactors.ordered list.
 */
export function selectTargets<T extends MovementTargetPayload | NonSelectionTargetPayload>(
  payload: T,
  state: Draft<EditorState>,
  services: EditorOperationServices
): (T extends MovementTargetPayload
  ? { interactor: Interactor; navigator: CursorNavigator }
  : { interactor?: Interactor; navigator: CursorNavigator })[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payloadTargetUntyped: any = payload.target;

  const result: { interactor?: Interactor; navigator: CursorNavigator }[] = [];

  const recordResult = (target: InteractorId | Cursor) => {
    const interactor = target instanceof Cursor ? undefined : state.interactors.byId[target];
    const mainCursor: Cursor = interactor ? interactor.mainCursor : (target as Cursor);
    const nav = new CursorNavigator(state.document, services.layout);
    if (!nav.navigateTo(mainCursor)) {
      throw new EditorOperationError(
        EditorOperationErrorCode.InvalidCursorPosition,
        target instanceof Cursor
          ? // TODO give cursor a toString
            `Cursor ${target.orientation} ${target.path.toString()} is invalid`
          : `Interactor ${interactor?.id || ""} had an invalid mainCursor position.`
      );
    }
    result.push({ interactor, navigator: nav });
  };

  if (payloadTargetUntyped === undefined) {
    if (state.interactors.focusedId) {
      recordResult(state.interactors.focusedId);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  } else if (payloadTargetUntyped.interactorId !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    recordResult(payloadTargetUntyped.interactorId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  } else if (payloadTargetUntyped.interactorIds !== undefined) {
    state.interactors.ordered
      .filter((x: InteractorId) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      payloadTargetUntyped.interactorIds.includes(x)
      )
      .forEach((id) => recordResult(id));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  } else if (payloadTargetUntyped.cursors !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    payloadTargetUntyped.cursors.forEach(recordResult);
  } else if (payload.target instanceof Cursor) {
    recordResult(payloadTargetUntyped);
  } else {
    switch (payload.target) {
      case InteractorTarget.All:
        state.interactors.ordered.forEach(recordResult);
        break;
      case InteractorTarget.AllActive:
        for (let i = 0; i < state.interactors.ordered.length; i++) {
          const id = state.interactors.ordered[i];
          const interactor = state.interactors.byId[id];
          if (interactor.status === InteractorStatus.Active) {
            recordResult(id);
          }
        }
        break;
      case InteractorTarget.Focused:
        if (state.interactors.focusedId) {
          recordResult(state.interactors.focusedId);
        }
        break;
    }
  }

  // This is beyond the understanding of typescripts type system but it is really ok
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
  return result as any;
}
