import { Draft } from "immer";

import { NodeNavigator } from "../basic-traversal";
import { CursorNavigator } from "../cursor";
import { EditorState, Interactor, InteractorId } from "../editor";
import { Node } from "../models";

import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { EditorOperationServices, EditorServices } from "./services";
import { OperationTarget, getTargetedInteractorIds } from "./target";

export enum FlowDirection {
  Backward = "BACKWARD",
  Forward = "FORWARD",
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
 * Interactor.
 *
 * Throws an error if the navigation fails.
 */
function getMainCursorNavigatorFor(target: Interactor, state: EditorState, services: EditorServices): CursorNavigator {
  const nav = new CursorNavigator(state.document, services.layout);
  if (!nav.navigateTo(target.mainCursor)) {
    throw new EditorOperationError(
      EditorOperationErrorCode.InvalidCursorPosition,
      `Interactor ${target.id || ""} had an invalid mainCursor position.`
    );
  }
  return nav;
}

/**
 * Simple create two CursorNavigator for an selection Interactor (ordered) and
 * return them.
 *
 * Throws an error if the navigation fails.
 */
function getBothCursorNavigatorsForSelection(
  target: Interactor,
  state: EditorState,
  services: EditorServices
): { navigators: [CursorNavigator, CursorNavigator]; isMainCursorFirst: boolean } | undefined {
  const result = target.getSelectionCursorsOrdered();
  if (!result) {
    return;
  }
  const { cursors, isMainCursorFirst } = result;
  const nav1 = new CursorNavigator(state.document, services.layout);

  if (!nav1.navigateTo(cursors[0])) {
    throw new EditorOperationError(
      EditorOperationErrorCode.InvalidCursorPosition,
      `Interactor ${target.id || ""} had an invalid cursor position.`
    );
  }

  const nav2 = new CursorNavigator(state.document, services.layout);

  if (!nav2.navigateTo(cursors[1])) {
    throw new EditorOperationError(
      EditorOperationErrorCode.InvalidCursorPosition,
      `Interactor ${target.id || ""} had an invalid cursor position.`
    );
  }

  return { navigators: [nav1, nav2], isMainCursorFirst };
}

export function getNavigatorToSiblingIfMatchingPredicate(
  navigator: NodeNavigator,
  direction: FlowDirection,
  predicate: (node: Node) => boolean
): NodeNavigator | undefined {
  const navPrime = navigator.clone();
  if (
    !(direction === FlowDirection.Backward ? navPrime.navigateToPrecedingSibling() : navPrime.navigateToNextSibling())
  ) {
    return undefined;
  }

  const candidate = navPrime.tip.node;
  if (!predicate(candidate)) {
    return undefined;
  }
  return navPrime;
}

export function ifLet<C, T>(a: C | undefined, callback: (a: C) => T): T | undefined {
  if (a !== undefined) {
    return callback(a);
  }
  return undefined;
}

export function navigateToAncestorMatchingPredicate(
  navigator: NodeNavigator,
  predicate: (node: Node) => boolean
): NodeNavigator | undefined {
  while (!predicate(navigator.tip.node)) {
    if (!navigator.navigateToParent()) {
      return undefined;
    }
  }
  return navigator;
}

export type SelectTargetsResult =
  | { isSelection: false; interactor: Draft<Interactor>; navigator: CursorNavigator }
  | {
      isSelection: true;
      interactor: Draft<Interactor>;
      navigators: [CursorNavigator, CursorNavigator];
      isMainCursorFirst: boolean;
    };
/**
 * The returned interactors (if there are interactors) are in the exact same
 * order as they appear in the interactors.ordered list.
 */
export function selectTargets(
  state: Draft<EditorState>,
  services: EditorOperationServices,
  target: OperationTarget
): SelectTargetsResult[] {
  const result: SelectTargetsResult[] = [];

  const recordResult = (t: InteractorId) => {
    const interactor = state.interactors[t];
    if (interactor.isSelection) {
      const r = getBothCursorNavigatorsForSelection(interactor, state, services);
      if (r) {
        result.push({ isSelection: true, interactor, ...r });
      }
    } else {
      const nav = getMainCursorNavigatorFor(interactor, state, services);
      result.push({ isSelection: false, interactor, navigator: nav });
    }
  };
  getTargetedInteractorIds(target, state).forEach(recordResult);
  return result;
}
