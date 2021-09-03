import { Draft } from "immer";
import lodash from "lodash";

import { NodeNavigator, Path, PathString, Range } from "../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation } from "../cursor";
import { Block, Node, NodeUtils } from "../document-model";
import { SimpleComparison } from "../miscUtils";
import { FlowDirection, Interactor, InteractorId, WorkingDocument } from "../working-document";

import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { EditorOperationServices } from "./services";
import { EditorState } from "./state";
import { OperationTarget, getTargetedInteractorIds } from "./target";

export type InteractorInputPosition = Cursor | { path: Path | PathString; orientation: CursorOrientation };

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

export function getNearestAncestorBlock(navigator: NodeNavigator | CursorNavigator): Block | undefined {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  return navigator.chain.searchBackwards(NodeUtils.isBlock)?.node as Block | undefined;
}

export function isNavigatorAtEdgeOfTextContainer(navigator: CursorNavigator, direction: FlowDirection): boolean {
  const parent = navigator.chain.parent?.node;
  if (parent && NodeUtils.isTextContainer(parent)) {
    const index = navigator.tip.pathPart.index;
    if (
      index === 0 &&
      (navigator.cursor.orientation === CursorOrientation.Before ||
        (navigator.cursor.orientation === CursorOrientation.On && direction === FlowDirection.Backward))
    ) {
      return true;
    }
    if (
      index == parent.children.length - 1 &&
      (navigator.cursor.orientation === CursorOrientation.After ||
        (navigator.cursor.orientation === CursorOrientation.On && direction === FlowDirection.Forward))
    ) {
      return true;
    }
  }
  return false;
}

export function isNavigatorAtEdgeOfBlock(navigator: CursorNavigator, direction: FlowDirection): boolean {
  const block = getNearestAncestorBlock(navigator);
  if (!block) {
    return false;
  }
  const nav2 = navigator.clone();
  if (
    (direction === FlowDirection.Backward && !nav2.navigateToPrecedingCursorPosition()) ||
    (direction === FlowDirection.Forward && !nav2.navigateToNextCursorPosition())
  ) {
    return true;
  }

  const newBlockMaybe = getNearestAncestorBlock(nav2);
  return block !== newBlockMaybe;
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
  target: OperationTarget,
  ordered?: boolean
): SelectTargetsResult[] {
  const result: (SelectTargetsResult & { firstCursor: Cursor | undefined })[] = [];

  const recordResult = (t: InteractorId) => {
    const interactor = state.getInteractor(t);
    if (!interactor) {
      return;
    }
    if (interactor.isSelection) {
      const r = getBothCursorNavigatorsForSelection(interactor, state, services);
      if (r) {
        result.push({
          isSelection: true,
          interactor,
          ...r,
          firstCursor: ordered ? (r.isMainCursorFirst ? r.navigators[0].cursor : r.navigators[1].cursor) : undefined,
        });
      }
    } else {
      const nav = getMainCursorNavigatorFor(interactor, state, services);
      result.push({ isSelection: false, interactor, navigator: nav, firstCursor: ordered ? nav.cursor : undefined });
    }
  };
  getTargetedInteractorIds(target, state).forEach(recordResult);
  if (ordered && result.length > 1) {
    result.sort((left, right) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const cmp = left.firstCursor!.compareTo(right.firstCursor!);
      switch (cmp) {
        case SimpleComparison.Before:
          return -1;
        case SimpleComparison.After:
          return 1;
        default:
          return 0;
      }
    });
  }
  return result;
}
