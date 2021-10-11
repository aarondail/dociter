import { Draft } from "immer";

import { NodeNavigator } from "../basic-traversal";
import { CursorNavigator, CursorOrientation } from "../cursor";
import { Side } from "../miscUtils";
import { Interactor } from "../working-document";

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
        state.updateInteractor(interactor.id, {
          to: services.interactors.cursorNavigatorToAnchorPosition(navigator),
          lineMovementHorizontalVisualPosition: undefined,
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
        state.updateInteractor(interactor.id, {
          to: services.interactors.cursorNavigatorToAnchorPosition(navigator),
          lineMovementHorizontalVisualPosition: undefined,
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
      return moveVisualUpOrDownHelper(state, services, "DOWN", interactor, navigator);
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
      return moveVisualUpOrDownHelper(state, services, "UP", interactor, navigator);
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
      state.updateInteractor(interactor.id, {
        to: services.interactors.convertInteractorInputPositionToAnchorPosition(payload.to),
        lineMovementHorizontalVisualPosition: undefined,
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
  state: Draft<EditorState>,
  services: EditorOperationServices,
  direction: "UP" | "DOWN",
  interactor: Draft<Interactor>,
  navigator: CursorNavigator
): void {
  const startNavigator = navigator.clone().toNodeNavigator();

  const targetAnchor =
    interactor.lineMovementHorizontalVisualPosition ??
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
      ? services.layout!.detectLineWrapOrBreakBetweenNodes(anchor, navigator.toNodeNavigator())
      : services.layout!.detectLineWrapOrBreakBetweenNodes(navigator.toNodeNavigator(), anchor);

  let foundNewLine = false;
  while (advance()) {
    // TODO do something like what we are doing in the second loop to find the
    // EOL in terms of siblings from current or if there is NO EOL among the
    // siblings so we can skip ahead
    //
    // Also...  probably consider changing the way the doctarion-browser-utils
    // works so that it doesn't have to compute all the line breaks in a
    // InlineText to do its work

    if (didLineWrap(startNavigator)) {
      foundNewLine = true;
      break;
    }
  }

  if (!foundNewLine) {
    return;
  }

  // Now that we think we are on the next line...
  let distance = services.layout!.detectHorizontalDistanceFromTargetHorizontalAnchor(
    navigator.toNodeNavigator(),
    navigator.cursor.orientation === CursorOrientation.After ? Side.Right : Side.Left,
    targetAnchor
  );

  if (!distance) {
    return;
  }

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
      if (didLineWrap(newLineStartNavigator)) {
        retreat();
        break;
      }

      const newDistance = services.layout?.detectHorizontalDistanceFromTargetHorizontalAnchor(
        navigator.toNodeNavigator(),
        navigator.cursor.orientation === CursorOrientation.After ? Side.Right : Side.Left,
        targetAnchor
      );
      if (!newDistance) {
        retreat();
        break;
      }
      if (Math.abs(newDistance.distance) > Math.abs(distance.distance)) {
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

  state.updateInteractor(interactor.id, {
    to: services.interactors.cursorNavigatorToAnchorPosition(navigator),
    lineMovementHorizontalVisualPosition: undefined,
    selectTo: undefined,
  });
}
