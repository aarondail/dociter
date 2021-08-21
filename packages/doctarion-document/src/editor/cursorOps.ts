import { Draft } from "immer";

import { NodeNavigator } from "../basic-traversal";
import { CursorNavigator, CursorOrientation } from "../cursor";
import { NodeLayoutReporter, Side } from "../layout-reporting";

import { Anchor } from "./anchor";
import { Interactor } from "./interactor";
import { createCoreOperation } from "./operation";
import { InteractorMovementPayload } from "./payloads";
import { EditorOperationServices } from "./services";
import { EditorState } from "./state";
import { InteractorInputPosition, convertInteractorInputPositionToAnchor, selectTargets } from "./utils";

export const moveBack = createCoreOperation<InteractorMovementPayload>(
  "cursor/moveBack",
  (state, services, payload): void => {
    forEachInteractorInMovementTargetPayloadDo(state, services, payload, (interactor, navigator) => {
      if (navigator.navigateToPrecedingCursorPosition()) {
        const oldAnchor = interactor.mainAnchor;
        const newAnchor = Anchor.fromCursorNavigator(navigator);
        if (newAnchor) {
          interactor.mainAnchor = newAnchor;
          interactor.lineMovementHorizontalVisualAnchor = undefined;
          interactor.selectionAnchor = payload.select ? interactor.selectionAnchor ?? oldAnchor : undefined;
          return true;
        }
      }
      return false;
    });
  }
);

export const moveForward = createCoreOperation<InteractorMovementPayload>(
  "cursor/moveForward",
  (state, services, payload): void => {
    forEachInteractorInMovementTargetPayloadDo(state, services, payload, (interactor, navigator) => {
      if (navigator.navigateToNextCursorPosition()) {
        const oldAnchor = interactor.mainAnchor;
        const newAnchor = Anchor.fromCursorNavigator(navigator);
        if (newAnchor) {
          interactor.mainAnchor = newAnchor;
          interactor.lineMovementHorizontalVisualAnchor = undefined;
          interactor.selectionAnchor = payload.select ? interactor.selectionAnchor ?? oldAnchor : undefined;
          return true;
        }
      }
      return false;
    });
  }
);

export const moveVisualDown = createCoreOperation<InteractorMovementPayload>(
  "cursor/moveVisualDown",
  (state, services, payload) => {
    forEachInteractorInMovementTargetPayloadDo(state, services, payload, (interactor, navigator) => {
      if (!services.layout) {
        return false;
      }
      return moveVisualUpOrDownHelper("DOWN", services.layout, interactor, navigator);
    });
  }
);

// export function moveLineDown(state: immer.Draft<EditorState>): void {
//   const nav = getCursorNavigatorAndValidate(state);
//   if (nav.navigateToPrecedingCursorPosition()) {
//     state.cursor = castDraft(nav.cursor);
//     clearSelection(state);
//     resetCursorMovementHints(state);
//   }
// }

export const moveVisualUp = createCoreOperation<InteractorMovementPayload>(
  "cursor/moveVisualUp",
  (state, services, payload) => {
    forEachInteractorInMovementTargetPayloadDo(state, services, payload, (interactor, navigator) => {
      if (!services.layout) {
        return false;
      }
      return moveVisualUpOrDownHelper("UP", services.layout, interactor, navigator);
    });
  }
);

// export function moveLineUp(state: immer.Draft<EditorState>): void {
//   const nav = getCursorNavigatorAndValidate(state);
//   if (nav.navigateToPrecedingCursorPosition()) {
//     state.cursor = castDraft(nav.cursor);
//     clearSelection(state);
//     resetCursorMovementHints(state);
//   }
// }

export const jump = createCoreOperation<{ to: InteractorInputPosition } & InteractorMovementPayload>(
  "cursor/jump",
  (state, services, payload): void => {
    const anchor = convertInteractorInputPositionToAnchor(state, services, payload.to);
    forEachInteractorInMovementTargetPayloadDo(state, services, payload, (interactor) => {
      const oldCursor = interactor.mainAnchor;
      interactor.mainAnchor = anchor;
      interactor.lineMovementHorizontalVisualAnchor = undefined;
      interactor.selectionAnchor = payload.select ? interactor.selectionAnchor ?? oldCursor : undefined;
      return true;
    });
  }
);

function forEachInteractorInMovementTargetPayloadDo(
  state: Draft<EditorState>,
  services: EditorOperationServices,
  payload: InteractorMovementPayload,
  updateFn: (interactor: Draft<Interactor>, navigator: CursorNavigator) => boolean
): void {
  for (const target of selectTargets(state, services, payload.target)) {
    if (target.isSelection) {
      const { interactor, navigators, isMainCursorFirst } = target;
      if (updateFn(interactor, isMainCursorFirst ? navigators[0] : navigators[1])) {
        services.interactors.notifyUpdated(interactor.id);
      }
    } else {
      const { interactor, navigator } = target;
      if (updateFn(interactor, navigator)) {
        services.interactors.notifyUpdated(interactor.id);
      }
    }
  }
}

/**
 * This returns true if it updates the interactor.
 */
// An alternative implementation of this might use:
// https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint
// or
// https://developer.mozilla.org/en-US/docs/Web/API/Document/caretRangeFromPoint
function moveVisualUpOrDownHelper(
  direction: "UP" | "DOWN",
  layout: NodeLayoutReporter,
  interactor: Draft<Interactor>,
  navigator: CursorNavigator
): boolean {
  const startNavigator = navigator.clone().toNodeNavigator();

  const targetAnchor =
    interactor.lineMovementHorizontalVisualAnchor ??
    layout.getTargetHorizontalAnchor(
      startNavigator,
      navigator.cursor.orientation === CursorOrientation.After ? Side.Right : Side.Left
    );
  if (targetAnchor === undefined) {
    return false;
  }

  const advance = () =>
    direction === "DOWN" ? navigator.navigateToNextCursorPosition() : navigator.navigateToPrecedingCursorPosition();
  const retreat = () =>
    direction === "DOWN" ? navigator.navigateToPrecedingCursorPosition() : navigator.navigateToNextCursorPosition();
  const didLineWrap = (anchor: NodeNavigator) =>
    direction === "DOWN"
      ? layout.detectLineWrapOrBreakBetweenNodes(anchor, navigator.toNodeNavigator())
      : layout.detectLineWrapOrBreakBetweenNodes(navigator.toNodeNavigator(), anchor);

  let foundNewLine = false;
  while (advance()) {
    // TODO do something like what we are doing in the second loop to find the
    // EOL in terms of siblings from current or if there is NO EOL among the
    // siblings so we can skip ahead
    //
    // Also...  probably consider changing the way the doctarion-browser-utils
    // works so that it doesn't have to compute all the line breaks in a
    // InlineText to do its work

    // console.log("cursorOps:loop1:advance ", currentNavigator.tip.node, currentNavigator.tip.pathPart.index);
    if (didLineWrap(startNavigator)) {
      foundNewLine = true;
      break;
    }
  }
  // console.log("cursorOps:lopp1:done ", currentNavigator.tip.node, currentNavigator.tip.pathPart.index);

  if (!foundNewLine) {
    return false;
  }

  // console.log("found new line", currentLayoutRect, nav.tip.node);
  // Now that we think we are on the next line...
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let distance = layout.detectHorizontalDistanceFromTargetHorizontalAnchor(
    navigator.toNodeNavigator(),
    navigator.cursor.orientation === CursorOrientation.After ? Side.Right : Side.Left,
    targetAnchor
  );

  if (!distance) {
    return false;
  }

  // console.log(distance);
  if (distance.estimatedSubjectSiblingsToTarget) {
    navigator.navigateToRelativeSibling(
      distance.estimatedSubjectSiblingsToTarget,
      distance.estimatedSubjectSiblingSideClosestToTarget === Side.Left
        ? CursorOrientation.Before
        : CursorOrientation.After
    );
  } else {
    const newLineStartNavigator = navigator.toNodeNavigator();

    while (advance()) {
      // console.log("curos:loop2:advance");
      if (didLineWrap(newLineStartNavigator)) {
        // console.log("curos:loop2:line wrap detected");
        retreat();
        break;
      }

      const newDistance = layout.detectHorizontalDistanceFromTargetHorizontalAnchor(
        navigator.toNodeNavigator(),
        navigator.cursor.orientation === CursorOrientation.After ? Side.Right : Side.Left,
        targetAnchor
      );
      if (!newDistance) {
        // console.log("curos:loop2:dist null");
        retreat();
        break;
      }
      if (Math.abs(newDistance.distance) > Math.abs(distance.distance)) {
        // console.log("curos:loop2:dist ok");
        retreat();
        break;
      }
      if (newDistance.estimatedSubjectSiblingsToTarget) {
        navigator.navigateToRelativeSibling(
          newDistance.estimatedSubjectSiblingsToTarget,
          newDistance.estimatedSubjectSiblingSideClosestToTarget === Side.Left
            ? CursorOrientation.Before
            : CursorOrientation.After
        );
        break;
      }

      distance = newDistance;
    }
  }

  const newAnchor = Anchor.fromCursorNavigator(navigator);
  if (newAnchor) {
    interactor.mainAnchor = newAnchor;
    interactor.selectionAnchor = undefined;
    interactor.lineMovementHorizontalVisualAnchor = undefined;
    return true;
  }
  return false;
}
