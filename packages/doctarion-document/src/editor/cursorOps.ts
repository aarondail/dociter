import { Draft } from "immer";

import { NodeNavigator } from "../basic-traversal";
import { CursorNavigator, CursorOrientation } from "../cursor";
import { Side } from "../layout-reporting";

import { Interactor } from "./interactor";
import { createCoreOperation } from "./operation";
import { InteractorMovementPayload } from "./payloads";
import { EditorOperationServices } from "./services";
import { EditorState } from "./state";
import { InteractorInputPosition, selectTargets } from "./utils";

export const moveBack = createCoreOperation<InteractorMovementPayload>(
  "cursor/moveBack",
  (state, services, payload): void => {
    forEachInteractorInMovementTargetPayloadDo(state, services, payload, (interactor, navigator) => {
      if (navigator.navigateToPrecedingCursorPosition()) {
        services.interactors.updateInteractor(interactor.id, {
          to: navigator.cursor,
          lineMovementHorizontalVisualAnchor: undefined,
          selectTo: payload.select ? "main" : undefined,
        });
      }
    });
  }
);

export const moveForward = createCoreOperation<InteractorMovementPayload>(
  "cursor/moveForward",
  (state, services, payload): void => {
    forEachInteractorInMovementTargetPayloadDo(state, services, payload, (interactor, navigator) => {
      if (navigator.navigateToNextCursorPosition()) {
        services.interactors.updateInteractor(interactor.id, {
          to: navigator.cursor,
          lineMovementHorizontalVisualAnchor: undefined,
          selectTo: payload.select ? "main" : undefined,
        });
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
      return moveVisualUpOrDownHelper(services, "DOWN", interactor, navigator);
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
      return moveVisualUpOrDownHelper(services, "UP", interactor, navigator);
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
    forEachInteractorInMovementTargetPayloadDo(state, services, payload, (interactor) => {
      services.interactors.updateInteractor(interactor.id, {
        to: payload.to,
        lineMovementHorizontalVisualAnchor: undefined,
        selectTo: payload.select ? "main" : undefined,
      });
    });
  }
);

function forEachInteractorInMovementTargetPayloadDo(
  state: Draft<EditorState>,
  services: EditorOperationServices,
  payload: InteractorMovementPayload,
  updateFn: (interactor: Draft<Interactor>, navigator: CursorNavigator) => void
): void {
  for (const target of selectTargets(state, services, payload.target)) {
    if (target.isSelection) {
      const { interactor, navigators, isMainCursorFirst } = target;
      updateFn(interactor, isMainCursorFirst ? navigators[0] : navigators[1]);
    } else {
      const { interactor, navigator } = target;
      updateFn(interactor, navigator);
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
  services: EditorOperationServices,
  direction: "UP" | "DOWN",
  interactor: Draft<Interactor>,
  navigator: CursorNavigator
): void {
  const startNavigator = navigator.clone().toNodeNavigator();

  const targetAnchor =
    interactor.lineMovementHorizontalVisualAnchor ??
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    services.layout!.getTargetHorizontalAnchor(
      startNavigator,
      navigator.cursor.orientation === CursorOrientation.After ? Side.Right : Side.Left
    );
  if (targetAnchor === undefined) {
    return;
  }

  const advance = () =>
    direction === "DOWN" ? navigator.navigateToNextCursorPosition() : navigator.navigateToPrecedingCursorPosition();
  const retreat = () =>
    direction === "DOWN" ? navigator.navigateToPrecedingCursorPosition() : navigator.navigateToNextCursorPosition();
  const didLineWrap = (anchor: NodeNavigator) =>
    direction === "DOWN"
      ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        services.layout!.detectLineWrapOrBreakBetweenNodes(anchor, navigator.toNodeNavigator())
      : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        services.layout!.detectLineWrapOrBreakBetweenNodes(navigator.toNodeNavigator(), anchor);

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
    return;
  }

  // console.log("found new line", currentLayoutRect, nav.tip.node);
  // Now that we think we are on the next line...
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let distance = services.layout!.detectHorizontalDistanceFromTargetHorizontalAnchor(
    navigator.toNodeNavigator(),
    navigator.cursor.orientation === CursorOrientation.After ? Side.Right : Side.Left,
    targetAnchor
  );

  if (!distance) {
    return;
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

      const newDistance = services.layout?.detectHorizontalDistanceFromTargetHorizontalAnchor(
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

  services.interactors.updateInteractor(interactor.id, {
    to: navigator.cursor,
    lineMovementHorizontalVisualAnchor: undefined,
    selectTo: undefined,
  });
}
