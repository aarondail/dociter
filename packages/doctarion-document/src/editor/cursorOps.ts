import { NodeNavigator, Path, PathString } from "../basic-traversal";
import { CursorNavigator, CursorOrientation } from "../cursor";
import { MovementTargetPayload } from "../editor";
import { Interactor, InteractorUpdateParams } from "../interactor";
import { NodeLayoutReporter, Side } from "../layout-reporting";

import { createCoreOperation } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { forEachInteractorInPayloadDo as forEachTargettedInteractorDo } from "./utils";

const castDraft = immer.castDraft;

export const moveBack = createCoreOperation<MovementTargetPayload>(
  "cursor/moveBack",
  (state, services, payload): void => {
    forEachTargettedInteractorDo(state, services, payload, (interactor, navigator) => {
  if (navigator.navigateToPrecedingCursorPosition()) {
        const oldCursor = interactor.mainCursor;
        return {
          mainCursor: navigator.cursor,
          visualLineMovementHorizontalAnchor: undefined,
          selectionAnchorCursor: payload.select ? interactor.selectionAnchorCursor ?? oldCursor : undefined,
        };
  }
      return undefined;
});
  }
);

export const moveForward = createCoreOperation<MovementTargetPayload>(
  "cursor/moveForward",
  (state, services, payload): void => {
    forEachTargettedInteractorDo(state, services, payload, (interactor, navigator) => {
  if (navigator.navigateToNextCursorPosition()) {
        const oldCursor = interactor.mainCursor;
        return {
          mainCursor: navigator.cursor,
          visualLineMovementHorizontalAnchor: undefined,
          selectionAnchorCursor: payload.select ? interactor.selectionAnchorCursor ?? oldCursor : undefined,
        };
  }
      return undefined;
});
  }
);

export const moveVisualDown = createCoreOperation<MovementTargetPayload>(
  "cursor/moveVisualDown",
  (state, services, payload) => {
    forEachTargettedInteractorDo(state, services, payload, (interactor, navigator) => {
      if (!services.layout) {
        return undefined;
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

export const moveVisualUp = createCoreOperation<MovementTargetPayload>(
  "cursor/moveVisualUp",
  (state, services, payload) => {
    forEachTargettedInteractorDo(state, services, payload, (interactor, navigator) => {
      if (!services.layout) {
        return undefined;
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

export const jumpTo = createCoreOperation<
  { path: PathString | Path; orientation: CursorOrientation } & MovementTargetPayload
>("cursor/jumpTo", (state, services, payload): void => {
  forEachTargettedInteractorDo(state, services, payload, (interactor, navigator) => {
    if (navigator.navigateTo(payload.path, payload.orientation)) {
      const oldCursor = interactor.mainCursor;
      return {
        mainCursor: navigator.cursor,
        visualLineMovementHorizontalAnchor: undefined,
        selectionAnchorCursor: payload.select ? interactor.selectionAnchorCursor ?? oldCursor : undefined,
      };
    } else {
      throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "path is invalid");
    }
  });
});

// An alternative implementation of this might use:
// https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint
// or
// https://developer.mozilla.org/en-US/docs/Web/API/Document/caretRangeFromPoint
function moveVisualUpOrDownHelper(
  direction: "UP" | "DOWN",
  layout: NodeLayoutReporter,
  interactor: Interactor,
  navigator: CursorNavigator
): InteractorUpdateParams | undefined {
  const startNavigator = navigator.clone().toNodeNavigator();

  const targetAnchor =
    interactor.visualLineMovementHorizontalAnchor ??
    layout.getTargetHorizontalAnchor(
      startNavigator,
      navigator.cursor.orientation === CursorOrientation.After ? Side.Right : Side.Left
    );
  if (targetAnchor === undefined) {
    return undefined;
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
    return;
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

  return {
    mainCursor: navigator.cursor,
    selectionAnchorCursor: undefined,
    visualLineMovementHorizontalAnchor: targetAnchor,
  };
}
