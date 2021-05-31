import { Draft, castDraft } from "immer";

import { Cursor, CursorNavigator } from "../cursor";
import { EditorState } from "../editor";
import { Interactor, InteractorId, InteractorStatus } from "../interactor";
import { SimpleComparison } from "../miscUtils";

import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { EditorOperationServices, EditorServices } from "./services";
import {
  OperationCursorTarget,
  OperationInteractorTarget,
  getTargetedCursors,
  getTargetedInteractorIds,
  isOperationCursorTarget,
  isOperationInteractorTarget,
} from "./target";

export function ifLet<C, T>(a: C | undefined, callback: (a: C) => T): T | undefined {
  if (a !== undefined) {
    return callback(a);
  }
  return undefined;
}

// TODO delete this
export function getCursorNavigatorAndValidate(
  state: EditorState,
  services: EditorOperationServices,
  // TODO change back
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interactorId: number // InteractorId
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
 * Simple create a CursorNavigator and navigate it to the proper place for an
 * Interactor or a simple Cursor.
 *
 * Throws an error if the navigation fails.
 */
export function getCursorNavigatorFor(
  target: Interactor | Cursor,
  state: EditorState,
  services: EditorServices
): CursorNavigator {
  const nav = new CursorNavigator(state.document, services.layout);
  if (!nav.navigateTo(target instanceof Cursor ? target : target.mainCursor)) {
    throw new EditorOperationError(
      EditorOperationErrorCode.InvalidCursorPosition,
      target instanceof Cursor
        ? // TODO give cursor a toString
          `Cursor ${target.orientation} ${target.path.toString()} is invalid`
        : `Interactor ${target.id || ""} had an invalid mainCursor position.`
    );
  }
  return nav;
}

/**
 * Used after the document has been updated in an operation to make sure the
 * element chain of the document has updated elements.
 */
// TODO delete?
export function refreshNavigator(nav: CursorNavigator): CursorNavigator {
  const n = new CursorNavigator(nav.document);
  n.navigateToUnchecked(nav.cursor);
  return n;
}

/**
 * The returned interactors (if there are interactors) are in the exact same
 * order as they appear in the interactors.ordered list.
 */
export function selectTargets<T extends OperationInteractorTarget | OperationCursorTarget>(
  state: Draft<EditorState>,
  services: EditorOperationServices,
  target: T
): (T extends OperationInteractorTarget
  ? { interactor: Interactor; navigator: CursorNavigator }
  : { navigator: CursorNavigator })[] {
  const result: { interactor?: Interactor; navigator: CursorNavigator }[] = [];

  const recordResult = (t: InteractorId | Cursor) => {
    const interactor = t instanceof Cursor ? undefined : state.interactors.byId[t];
    const nav = getCursorNavigatorFor(interactor ? interactor : (t as Cursor), state, services);
    result.push({ interactor, navigator: nav });
  };

  if (isOperationInteractorTarget(target)) {
    getTargetedInteractorIds(target, state.interactors).forEach(recordResult);
  } else if (isOperationCursorTarget(target)) {
    getTargetedCursors(target).forEach(recordResult);
  }

  // This is beyond the understanding of typescripts type system but it is really ok
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
  return result as any;
}
