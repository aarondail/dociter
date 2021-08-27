import { Draft } from "immer";

import { NodeNavigator, Path, PathString, Range } from "../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation } from "../cursor";
import { Block, Node, NodeUtils } from "../document-model";
import { SimpleComparison } from "../miscUtils";
import { Interactor, InteractorId, WorkingDocument } from "../working-document";

import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { EditorOperationServices } from "./services";
import { EditorState } from "./state";
import { OperationTarget, getTargetedInteractorIds } from "./target";

export type InteractorInputPosition = Cursor | { path: Path | PathString; orientation: CursorOrientation };

// TODO delete this?
export function getCursorNavigatorAndValidate(
  state: Draft<EditorState>,
  services: EditorOperationServices,
  // TODO change back
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interactorId: number // InteractorId
): CursorNavigator {
  const nav = new CursorNavigator(state.document, services.layout);
  const interactor = state.getAllInteractors()[0];
  if (!interactor) {
    throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "no interactor found with the given id");
  } else {
    const anchor = state.getAnchor(interactor.mainAnchor);
    const cursor = anchor && services.interactors.anchorToCursor(anchor);
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
function getMainCursorNavigatorFor(
  target: Interactor,
  state: Draft<EditorState>,
  services: EditorOperationServices
): CursorNavigator {
  const nav = new CursorNavigator(state.document, services.layout);
  const anchor = state.getAnchor(target.mainAnchor);
  const cursor = anchor && services.interactors.anchorToCursor(anchor);
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
  state: Draft<EditorState>,
  services: EditorOperationServices
): { navigators: [CursorNavigator, CursorNavigator]; isMainCursorFirst: boolean } | undefined {
  const main = state.getAnchor(target.mainAnchor);
  const mainCursor = main && services.interactors.anchorToCursor(main);
  const sa = target.selectionAnchor && state.getAnchor(target.selectionAnchor);
  const saCursor = sa && services.interactors.anchorToCursor(sa);

  if (!mainCursor || !saCursor) {
    return;
  }

  const isMainCursorFirst = mainCursor.compareTo(saCursor) !== SimpleComparison.After;

  const nav1 = new CursorNavigator(state.document, services.layout);

  if (!nav1.navigateTo(mainCursor)) {
    throw new EditorOperationError(
      EditorOperationErrorCode.InvalidCursorPosition,
      `Interactor ${target.id || ""} had an invalid anchor.`
    );
  }

  const nav2 = new CursorNavigator(state.document, services.layout);

  if (!nav2.navigateTo(saCursor)) {
    throw new EditorOperationError(
      EditorOperationErrorCode.InvalidCursorPosition,
      `Interactor ${target.id || ""} had an invalid anchor.`
    );
  }

  return { navigators: [nav1, nav2], isMainCursorFirst };
}

export function getRangeForSelection(
  target: Interactor,
  workingDocument: Draft<WorkingDocument>,
  services: EditorOperationServices
): Range | undefined {
  const main = workingDocument.getAnchor(target.mainAnchor);
  const mainCursor = main && services.interactors.anchorToCursor(main);
  const sa = target.selectionAnchor && workingDocument.getAnchor(target.selectionAnchor);
  const saCursor = sa && services.interactors.anchorToCursor(sa);

  if (!mainCursor || !saCursor) {
    return;
  }

  const mainAfterSelect = mainCursor.compareTo(saCursor) === SimpleComparison.After;
  let fromPath = mainAfterSelect ? saCursor.path : mainCursor.path;
  if ((mainAfterSelect ? saCursor.orientation : mainCursor.orientation) === CursorOrientation.After) {
    const n = new NodeNavigator(workingDocument.document);
    if (!n.navigateTo(fromPath) || !n.navigateForwardsByDfs()) {
      return undefined;
    }
    fromPath = n.path;
  }

  let toPath = mainAfterSelect ? mainCursor.path : saCursor.path;
  if ((mainAfterSelect ? mainCursor.orientation : saCursor.orientation) === CursorOrientation.Before) {
    const n = new NodeNavigator(workingDocument.document);
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

export function getNearestAncestorBlock(navigator: NodeNavigator | CursorNavigator): Block | undefined {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  return navigator.chain.searchBackwards(NodeUtils.isBlock) as Block | undefined;
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

export function selectTargets(
  state: Draft<EditorState>,
  services: EditorOperationServices,
  target: OperationTarget
): SelectTargetsResult[] {
  const result: SelectTargetsResult[] = [];

  const recordResult = (t: InteractorId) => {
    const interactor = state.getInteractor(t);
    if (!interactor) {
      return;
    }
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
