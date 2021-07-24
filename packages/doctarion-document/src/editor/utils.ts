import { Draft } from "immer";

import { Cursor, CursorNavigator } from "../cursor";
import { EditorState } from "../editor";

import { Interactor, InteractorId } from "./interactor";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { EditorOperationServices, EditorServices } from "./services";
import { OperationTarget, getTargetedInteractorIds } from "./target";

export function ifLet<C, T>(a: C | undefined, callback: (a: C) => T): T | undefined {
  if (a !== undefined) {
    return callback(a);
  }
  return undefined;
}

// TODO delete this?
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

// export function getUnselectedInteractors(
//   state: Draft<EditorState>,
//   target: OperationTarget,
//   selectedTargets: { interactor: Draft<Interactor>; navigator: CursorNavigator }[]
// ): Draft<Interactor>[] {
//   // if (isOperationInteractorTarget(target)) {
//   const set = new Set();
//   for (const target of selectedTargets) {
//     // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
//     set.add(((target as any).interactor as Interactor).id);
//   }
//   const result = [];
//   for (const interactor of Object.values(state.interactors)) {
//     if (!set.has(interactor.id)) {
//       result.push(interactor);
//     }
//   }
//   return result;
//   // } else if (isOperationCursorTarget(target)) {
//   //   return Object.values(state.interactors);
//   // }
//   // return [];
// }

/**
 * The returned interactors (if there are interactors) are in the exact same
 * order as they appear in the interactors.ordered list.
 */
export function selectTargets(
  state: Draft<EditorState>,
  services: EditorOperationServices,
  target: OperationTarget
): { interactor: Draft<Interactor>; navigator: CursorNavigator }[] {
  const result: { interactor: Draft<Interactor>; navigator: CursorNavigator }[] = [];

  const recordResult = (t: InteractorId) => {
    const interactor = state.interactors[t];
    const nav = getCursorNavigatorFor(interactor, state, services);
    result.push({ interactor, navigator: nav });
  };
  getTargetedInteractorIds(target, state).forEach(recordResult);
  return result;
}
