import * as immer from "immer";

import { NodeNavigator, Path, PathString } from "../basic-traversal";
import { CursorAffinity, CursorNavigator } from "../cursor";
import { EditorOperationServices, EditorState } from "../editor";
import { Side } from "../layout-reporting/side";

import { OperationError, OperationErrorCode } from "./error";
import { clearSelection } from "./selectionOps";
import { getCursorNavigatorAndValidate } from "./utils";

const castDraft = immer.castDraft;

export function moveBack(state: immer.Draft<EditorState>, services: EditorOperationServices): void {
  const nav = getCursorNavigatorAndValidate(state, services);
  if (nav.navigateToPrecedingCursorPosition()) {
    state.cursor = castDraft(nav.cursor);
    clearSelection(state);
    resetCursorMovementHints(state);
  }
}

export function moveForward(state: immer.Draft<EditorState>, services: EditorOperationServices): void {
  const nav = getCursorNavigatorAndValidate(state, services);
  if (nav.navigateToNextCursorPosition()) {
    state.cursor = castDraft(nav.cursor);
    clearSelection(state);
    resetCursorMovementHints(state);
  }
}

export function moveVisualDown(state: immer.Draft<EditorState>, services: EditorOperationServices): void {
  moveVisualUpOrDownHelper(state, services, "DOWN");
}

// export function moveLineDown(state: immer.Draft<EditorState>): void {
//   const nav = getCursorNavigatorAndValidate(state);
//   if (nav.navigateToPrecedingCursorPosition()) {
//     state.cursor = castDraft(nav.cursor);
//     clearSelection(state);
//     resetCursorMovementHints(state);
//   }
// }

export function moveVisualUp(state: immer.Draft<EditorState>, services: EditorOperationServices): void {
  moveVisualUpOrDownHelper(state, services, "UP");
}

// export function moveLineUp(state: immer.Draft<EditorState>): void {
//   const nav = getCursorNavigatorAndValidate(state);
//   if (nav.navigateToPrecedingCursorPosition()) {
//     state.cursor = castDraft(nav.cursor);
//     clearSelection(state);
//     resetCursorMovementHints(state);
//   }
// }

export const jumpTo = (path: PathString | Path, affinity: CursorAffinity) => (
  state: immer.Draft<EditorState>
): void => {
  const nav = new CursorNavigator(state.document);
  if (nav.navigateTo(path, affinity)) {
    state.cursor = castDraft(nav.cursor);
    clearSelection(state);
    resetCursorMovementHints(state);
  } else {
    throw new OperationError(OperationErrorCode.InvalidArgument, "path is invalid");
  }
};

export function resetCursorMovementHints(state: immer.Draft<EditorState>): void {
  if (state.cursorVisualLineMovementHorizontalAnchor) {
    state.cursorVisualLineMovementHorizontalAnchor = undefined;
  }
}

// ############################################################################
// ############################################################################
// ############################################################################
// ############################################################################
// An alternative implementation of this might use:
// https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint
// or
// https://developer.mozilla.org/en-US/docs/Web/API/Document/caretRangeFromPoint
// function moveVisualUpOrDownHelperOlder(
//   state: immer.Draft<EditorState>,
//   services: EditorOperationServices,
//   direction: "UP" | "DOWN"
// ): void {
//   const nav = getCursorNavigatorAndValidate(state, services);
//   const startingLayoutRect = services.layout.getLayout(nav.toNodeNavigator());
//   if (!startingLayoutRect) {
//     return;
//   }
//   const advance = () =>
//     direction === "DOWN" ? nav.navigateToNextCursorPosition() : nav.navigateToPrecedingCursorPosition();
//   const retreat = () =>
//     direction === "DOWN" ? nav.navigateToPrecedingCursorPosition() : nav.navigateToNextCursorPosition();
//   const selectRectSide = (cursor: Cursor, rect: LayoutRect) =>
//     cursor.affinity === CursorAffinity.After ? rect.right : rect.left;

//   const targetXValue = state.cursorVisualLineMovementXHint ?? selectRectSide(state.cursor, startingLayoutRect);

//   // Part 1 of this algorithm is to detect the start of the next line ... by
//   // relatively simply just advancing the cursor until it "seems like" we are on
//   // a different line.
//   let priorLayoutRect: LayoutRect = startingLayoutRect;
//   let currentLayoutRect: LayoutRect | undefined;
//   let foundNewLine = false;
//   while (advance()) {
//     currentLayoutRect = services.layout.getLayout(nav.toNodeNavigator());
//     if (!currentLayoutRect) {
//       return;
//     }

//     if (
//       (direction === "DOWN" && services.layout.doesFollowingRectWrapToNewLine(priorLayoutRect, currentLayoutRect)) ||
//       (direction === "UP" && services.layout.doesPreceedingRectWrapToNewLine(priorLayoutRect, currentLayoutRect))
//     ) {
//       foundNewLine = true;
//       break;
//     }
//     priorLayoutRect = currentLayoutRect;
//   }

//   if (!currentLayoutRect || !foundNewLine) {
//     return;
//   }

//   // console.log("found new line", currentLayoutRect, nav.tip.node);
//   // Now that we think we are on the next line...
//   // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
//   let bestXPositionSoFar = direction === "DOWN" ? currentLayoutRect.left : currentLayoutRect.right;
//   do {
//     const nextLayoutRect = services.layout.getLayout(nav.toNodeNavigator());
//     if (!nextLayoutRect) {
//       return;
//     }
//     if (
//       (direction === "DOWN" && services.layout.doesFollowingRectWrapToNewLine(currentLayoutRect, nextLayoutRect)) ||
//       (direction === "UP" && services.layout.doesPreceedingRectWrapToNewLine(currentLayoutRect, nextLayoutRect))
//     ) {
//       // Moving to next line before we found a good match, so use last position
//       retreat();
//       break;
//     }

//     const xPosition = selectRectSide(nav.cursor, nextLayoutRect);
//     const newDiff = Math.abs(xPosition - targetXValue);
//     const oldDiff = Math.abs(bestXPositionSoFar - targetXValue);
//     // console.log("looking at", xPosition, newDiff, oldDiff);
//     // We expect the diff to get better until we pass the x value, when it
//     // starts to get worse... in which case we stop the search (though we have
//     // to move back to the prior position before finishing)
//     if (newDiff > oldDiff) {
//       retreat();
//       break;
//     }
//     bestXPositionSoFar = xPosition;
//   } while (advance());

//   // We always expect to have moved one past the best match
//   state.cursor = castDraft(nav.cursor);
//   if (state.cursorVisualLineMovementXHint === undefined) {
//     state.cursorVisualLineMovementXHint = targetXValue;
//   }
//   clearSelection(state);
// }

// ############################################################################
// ############################################################################
// ############################################################################
// ############################################################################
// An alternative implementation of this might use:
// https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint
// or
// https://developer.mozilla.org/en-US/docs/Web/API/Document/caretRangeFromPoint
function moveVisualUpOrDownHelper(
  state: immer.Draft<EditorState>,
  services: EditorOperationServices,
  direction: "UP" | "DOWN"
): void {
  if (!services.layout) {
    return;
  }
  const layout = services.layout;

  const currentNavigator = getCursorNavigatorAndValidate(state, services);
  const startNavigator = currentNavigator.clone().toNodeNavigator();

  const targetAnchor =
    state.cursorVisualLineMovementHorizontalAnchor ??
    services.layout.getTargetHorizontalAnchor(
      startNavigator,
      state.cursor.affinity === CursorAffinity.After ? Side.Right : Side.Left
    );
  if (targetAnchor === undefined) {
    return;
  }

  const advance = () =>
    direction === "DOWN"
      ? currentNavigator.navigateToNextCursorPosition()
      : currentNavigator.navigateToPrecedingCursorPosition();
  const retreat = () =>
    direction === "DOWN"
      ? currentNavigator.navigateToPrecedingCursorPosition()
      : currentNavigator.navigateToNextCursorPosition();
  const didLineWrap = (anchor: NodeNavigator) =>
    direction === "DOWN"
      ? layout.detectLineWrapOrBreakBetweenNodes(anchor, currentNavigator.toNodeNavigator())
      : layout.detectLineWrapOrBreakBetweenNodes(currentNavigator.toNodeNavigator(), anchor);

  let foundNewLine = false;
  while (advance()) {
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
    currentNavigator.toNodeNavigator(),
    currentNavigator.cursor.affinity === CursorAffinity.After ? Side.Right : Side.Left,
    targetAnchor
  );

  if (!distance) {
    return;
  }

  if (distance.estimatedSubjectSiblingsToTarget) {
    currentNavigator.navigateToRelativeSibling(
      distance.estimatedSubjectSiblingsToTarget,
      distance.estimatedSubjectSiblingSideClosestToTarget === Side.Left ? CursorAffinity.Before : CursorAffinity.After
    );
  } else {
    const newLineStartNavigator = currentNavigator.toNodeNavigator();

    while (advance()) {
      if (didLineWrap(newLineStartNavigator)) {
        retreat();
        break;
      }

      const newDistance = layout.detectHorizontalDistanceFromTargetHorizontalAnchor(
        currentNavigator.toNodeNavigator(),
        currentNavigator.cursor.affinity === CursorAffinity.After ? Side.Right : Side.Left,
        targetAnchor
      );
      if (!newDistance) {
        retreat();
        break;
      }
      if (Math.abs(newDistance.distance) >= Math.abs(distance.distance)) {
        retreat();
        break;
      }
      if (newDistance.estimatedSubjectSiblingsToTarget) {
        currentNavigator.navigateToRelativeSibling(
          newDistance.estimatedSubjectSiblingsToTarget,
          direction === "DOWN" ? CursorAffinity.Before : CursorAffinity.After
        );
        break;
      }

      distance = newDistance;
    }
  }

  state.cursor = castDraft(currentNavigator.cursor);
  if (state.cursorVisualLineMovementHorizontalAnchor === undefined) {
    state.cursorVisualLineMovementHorizontalAnchor = targetAnchor;
  }
  clearSelection(state);
}
