import { Draft } from "immer";

import { NodeNavigator, Path, PathString, Range } from "../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation } from "../cursor";
import { EditorState, Interactor, InteractorId } from "../editor";
import { SimpleComparison } from "../miscUtils";
import { Document, Node } from "../models";

import { Anchor } from "./anchor";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { EditorOperationServices, EditorServices } from "./services";
import { OperationTarget, getTargetedInteractorIds } from "./target";

export type InteractorInputPosition = Anchor | Cursor | { path: Path | PathString; orientation: CursorOrientation };

export enum FlowDirection {
  Backward = "BACKWARD",
  Forward = "FORWARD",
}

export function convertInteractorInputPositionToAnchor(
  state: EditorState,
  services: EditorServices,
  position: InteractorInputPosition
): Anchor {
  const nav = new CursorNavigator(state.document2.document, services.layout);
  if (position instanceof Anchor) {
    const cursor = position.toCursor(services);
    if (!cursor || !nav.navigateTo(cursor)) {
      throw new EditorOperationError(EditorOperationErrorCode.InvalidCursorPosition, "Invalid anchor");
    }
    return position;
  } else {
    const cursor =
      position instanceof Cursor
        ? position
        : new Cursor(position.path instanceof Path ? position.path : Path.parse(position.path), position.orientation);

    if (!cursor || !nav.navigateTo(cursor)) {
      throw new EditorOperationError(EditorOperationErrorCode.InvalidCursorPosition, "Invalid cursor position");
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return Anchor.fromCursorNavigator(nav)!;
  }
}

// TODO delete this?
export function getCursorNavigatorAndValidate(
  state: EditorState,
  services: EditorOperationServices,
  // TODO change back
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interactorId: number // InteractorId
): CursorNavigator {
  const nav = new CursorNavigator(state.document2.document, services.layout);
  const interactor = state.interactors[Object.keys(state.interactors)[0]]; //interactorId];
  if (!interactor) {
    throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "no interactor found with the given id");
  } else {
    const cursor = interactor.mainAnchor.toCursor(services);
    if (!cursor || !nav.navigateTo(cursor)) {
      throw new EditorOperationError(EditorOperationErrorCode.InvalidCursorPosition);
    }
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
  const nav = new CursorNavigator(state.document2.document, services.layout);
  const cursor = target.mainAnchor.toCursor(services);
  if (!cursor || !nav.navigateTo(cursor)) {
    throw new EditorOperationError(
      EditorOperationErrorCode.InvalidCursorPosition,
      `Interactor ${target.id || ""} had an invalid mainAnchor position.`
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
  const mainCursor = target.mainAnchor.toCursor(services);
  const saCursor = target.selectionAnchor?.toCursor(services);

  if (!mainCursor || !saCursor) {
    return;
  }

  const isMainCursorFirst = mainCursor.compareTo(saCursor) !== SimpleComparison.After;

  const nav1 = new CursorNavigator(state.document2.document, services.layout);

  if (!nav1.navigateTo(mainCursor)) {
    throw new EditorOperationError(
      EditorOperationErrorCode.InvalidCursorPosition,
      `Interactor ${target.id || ""} had an invalid anchor.`
    );
  }

  const nav2 = new CursorNavigator(state.document2.document, services.layout);

  if (!nav2.navigateTo(saCursor)) {
    throw new EditorOperationError(
      EditorOperationErrorCode.InvalidCursorPosition,
      `Interactor ${target.id || ""} had an invalid anchor.`
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

export function getRangeForSelection(
  target: Interactor,
  document: Document,
  services: EditorServices
): Range | undefined {
  const mainCursor = target.mainAnchor.toCursor(services);
  const saCursor = target.selectionAnchor?.toCursor(services);

  if (!mainCursor || !saCursor) {
    return;
  }

  const mainAfterSelect = mainCursor.compareTo(saCursor) === SimpleComparison.After;
  let fromPath = mainAfterSelect ? saCursor.path : mainCursor.path;
  if ((mainAfterSelect ? saCursor.orientation : mainCursor.orientation) === CursorOrientation.After) {
    const n = new NodeNavigator(document);
    if (!n.navigateTo(fromPath) || !n.navigateForwardsByDfs()) {
      return undefined;
    }
    fromPath = n.path;
  }

  let toPath = mainAfterSelect ? mainCursor.path : saCursor.path;
  if ((mainAfterSelect ? mainCursor.orientation : saCursor.orientation) === CursorOrientation.Before) {
    const n = new NodeNavigator(document);
    if (!n.navigateTo(toPath) || !n.navigateBackwardsByDfs()) {
      return undefined;
    }
    toPath = n.path;
  }

  return new Range(fromPath, toPath);
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
