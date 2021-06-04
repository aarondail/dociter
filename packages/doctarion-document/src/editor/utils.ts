import { Draft } from "immer";

import { Cursor, CursorNavigator } from "../cursor";
import { EditorState } from "../editor";

import { Interactor, InteractorId } from "./interactor";
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
  const interactor = state.interactors[Object.keys(state.interactors)[0]]; //interactorId];
  if (!interactor) {
    throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "no interactor found with the given id");
  } else if (!nav.navigateTo(interactor.mainCursor)) {
    throw new EditorOperationError(EditorOperationErrorCode.InvalidCursorPosition);
  }
  return nav;
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
  ? { interactor: Draft<Interactor>; navigator: CursorNavigator }
  : { navigator: CursorNavigator })[] {
  const result: { interactor?: Interactor; navigator: CursorNavigator }[] = [];

  const recordResult = (t: InteractorId | Cursor) => {
    const interactor = t instanceof Cursor ? undefined : state.interactors[t];
    const nav = getCursorNavigatorFor(interactor ? interactor : (t as Cursor), state, services);
    result.push({ interactor, navigator: nav });
  };

  if (isOperationInteractorTarget(target)) {
    getTargetedInteractorIds(target, state).forEach(recordResult);
  } else if (isOperationCursorTarget(target)) {
    getTargetedCursors(target).forEach(recordResult);
  }

  // This is beyond the understanding of typescripts type system but it is really ok
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
  return result as any;
}
