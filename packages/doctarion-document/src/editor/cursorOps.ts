import { Draft, castDraft } from "immer";

import { NodeNavigator } from "../basic-traversal";
import { CursorNavigator, CursorOrientation, CursorPosition } from "../cursor";
import { EditorOperationServices, EditorState } from "../editor";
import { NodeLayoutReporter, Side } from "../layout-reporting";

import { Interactor, InteractorId } from "./interactor";
import { createCoreOperation } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { InteractorMovementPayload } from "./payloads";
import { selectTargets } from "./utils";

export const moveBack = createCoreOperation<InteractorMovementPayload>(
  "cursor/moveBack",
  (state, services, payload): void => {
    forEachInteractorInMovementTargetPayloadDo(state, services, payload, (interactor, navigator) => {
      if (navigator.navigateToPrecedingCursorPosition()) {
        const oldCursor = interactor.mainCursor;
        interactor.mainCursor = castDraft(navigator.cursor);
        interactor.visualLineMovementHorizontalAnchor = undefined;
        interactor.selectionAnchorCursor = payload.select ? interactor.selectionAnchorCursor ?? oldCursor : undefined;
        return true;
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
        const oldCursor = interactor.mainCursor;
        interactor.mainCursor = castDraft(navigator.cursor);
        interactor.visualLineMovementHorizontalAnchor = undefined;
        interactor.selectionAnchorCursor = payload.select ? interactor.selectionAnchorCursor ?? oldCursor : undefined;
        return true;
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

export const jump = createCoreOperation<{ to: CursorPosition } & InteractorMovementPayload>(
  "cursor/jumpTo",
  (state, services, payload): void => {
    const cursor = CursorPosition.toCursor(payload.to);
    forEachInteractorInMovementTargetPayloadDo(state, services, payload, (interactor, navigator) => {
      if (navigator.navigateTo(cursor)) {
        const oldCursor = interactor.mainCursor;
        interactor.mainCursor = castDraft(navigator.cursor);
        interactor.visualLineMovementHorizontalAnchor = undefined;
        interactor.selectionAnchorCursor = payload.select ? interactor.selectionAnchorCursor ?? oldCursor : undefined;
        return true;
      } else {
        throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "path is invalid");
      }
    });
  }
);

function forEachInteractorInMovementTargetPayloadDo(
  state: Draft<EditorState>,
  services: EditorOperationServices,
  payload: InteractorMovementPayload,
  updateFn: (interactor: Draft<Interactor>, navigator: CursorNavigator) => boolean
): void {
  const targets = selectTargets(state, services, payload.target);

  const updates: InteractorId[] = [];
  targets.forEach(({ interactor, navigator }) => {
    if (updateFn(interactor, navigator)) {
      updates.push(interactor.id);
    }
  });

  if (updates.length > 0) {
    services.interactors.notifyUpdated(updates);
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
    interactor.visualLineMovementHorizontalAnchor ??
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

  interactor.mainCursor = castDraft(navigator.cursor);
  interactor.selectionAnchorCursor = undefined;
  interactor.visualLineMovementHorizontalAnchor = undefined;
  return true;
}
