import * as immer from "immer";

import { Path, PathString } from "../basic-traversal";
import { Cursor, CursorAffinity, CursorNavigator } from "../cursor";
import { EditorOperationServices, EditorState } from "../editor";
import { LayoutRect } from "../layout-reporting";
import { NodeUtils } from "../models";

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
  moveVisualUpOrDownHelperOld(state, services, "DOWN");
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
  moveVisualUpOrDownHelperOld(state, services, "UP");
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
  if (state.cursorVisualLineMovementXHint) {
    state.cursorVisualLineMovementXHint = undefined;
  }
}

// function moveVisualUpOrDownHelper(
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
//   let currentLayoutRect: LayoutRect | undefined;
//   let foundNewLine = false;
//   {
//     let priorLayoutRect: LayoutRect = startingLayoutRect;
//     // eslint-disable-next-line no-constant-condition
//     while (true) {
//       if (NodeUtils.isGrapheme(nav.tip.node)) {
//         const parentNav = nav.toNodeNavigator();
//         parentNav.navigateToParent();
//         const lineWrapIndex =
//           direction === "DOWN"
//             ? services.layout.findNextLineWrap(parentNav, nav.tip.pathPart.index)
//             : services.layout.findPreceedingLineWrap(parentNav, nav.tip.pathPart.index);
//         if (lineWrapIndex) {
//           foundNewLine =
//             parentNav.navigateToChild(direction === "DOWN" ? lineWrapIndex : lineWrapIndex - 1) &&
//             nav.navigateTo(parentNav.path);
//           currentLayoutRect = services.layout.getLayout(nav.toNodeNavigator());
//           break;
//         } else {
//           if (!parentNav.navigateForwardsInDfs({ skipDescendants: true }) || nav.navigateTo(parentNav.path)) {
//             break;
//           }
//           currentLayoutRect = services.layout.getLayout(nav.toNodeNavigator());
//           if (!currentLayoutRect) {
//             return;
//           }
//         }
//       } else {
//         if (!advance()) {
//           break;
//         }
//         currentLayoutRect = services.layout.getLayout(nav.toNodeNavigator());
//         if (!currentLayoutRect) {
//           return;
//         }

//         if (
//           (direction === "DOWN" &&
//             services.layout.doesFollowingRectWrapToNewLine(priorLayoutRect, currentLayoutRect)) ||
//           (direction === "UP" && services.layout.doesPreceedingRectWrapToNewLine(priorLayoutRect, currentLayoutRect))
//         ) {
//           foundNewLine = true;
//           break;
//         }
//       }

//       priorLayoutRect = currentLayoutRect;
//     }
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

// An alternative implementation of this might use:
// https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint
// or
// https://developer.mozilla.org/en-US/docs/Web/API/Document/caretRangeFromPoint
function moveVisualUpOrDownHelperOld(
  state: immer.Draft<EditorState>,
  services: EditorOperationServices,
  direction: "UP" | "DOWN"
): void {
  const nav = getCursorNavigatorAndValidate(state, services);
  const startingLayoutRect = services.layout.getLayout(nav.toNodeNavigator());
  if (!startingLayoutRect) {
    return;
  }
  const advance = () =>
    direction === "DOWN" ? nav.navigateToNextCursorPosition() : nav.navigateToPrecedingCursorPosition();
  const retreat = () =>
    direction === "DOWN" ? nav.navigateToPrecedingCursorPosition() : nav.navigateToNextCursorPosition();
  const selectRectSide = (cursor: Cursor, rect: LayoutRect) =>
    cursor.affinity === CursorAffinity.After ? rect.right : rect.left;

  const targetXValue = state.cursorVisualLineMovementXHint ?? selectRectSide(state.cursor, startingLayoutRect);

  // console.log( "moveVisualUpDown", direction, "node", nav.tip.node, "startingLayoutRect:", startingLayoutRect, "targetXValue: ", targetXValue);

  // Part 1 of this algorithm is to detect the start of the next line ... by
  // relatively simply just advancing the cursor until it "seems like" we are on
  // a different line.
  let priorLayoutRect: LayoutRect = startingLayoutRect;
  let currentLayoutRect: LayoutRect | undefined;
  let foundNewLine = false;
  while (advance()) {
    currentLayoutRect = services.layout.getLayout(nav.toNodeNavigator());
    if (!currentLayoutRect) {
      return;
    }

    if (
      (direction === "DOWN" && services.layout.doesFollowingRectWrapToNewLine(priorLayoutRect, currentLayoutRect)) ||
      (direction === "UP" && services.layout.doesPreceedingRectWrapToNewLine(priorLayoutRect, currentLayoutRect))
    ) {
      foundNewLine = true;
      break;
    }
    priorLayoutRect = currentLayoutRect;
  }

  if (!currentLayoutRect || !foundNewLine) {
    return;
  }

  // console.log("found new line", currentLayoutRect, nav.tip.node);
  // Now that we think we are on the next line...
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let bestXPositionSoFar = direction === "DOWN" ? currentLayoutRect.left : currentLayoutRect.right;
  do {
    const nextLayoutRect = services.layout.getLayout(nav.toNodeNavigator());
    if (!nextLayoutRect) {
      return;
    }
    if (
      (direction === "DOWN" && services.layout.doesFollowingRectWrapToNewLine(currentLayoutRect, nextLayoutRect)) ||
      (direction === "UP" && services.layout.doesPreceedingRectWrapToNewLine(currentLayoutRect, nextLayoutRect))
    ) {
      // Moving to next line before we found a good match, so use last position
      retreat();
      break;
    }

    const xPosition = selectRectSide(nav.cursor, nextLayoutRect);
    const newDiff = Math.abs(xPosition - targetXValue);
    const oldDiff = Math.abs(bestXPositionSoFar - targetXValue);
    // console.log("looking at", xPosition, newDiff, oldDiff);
    // We expect the diff to get better until we pass the x value, when it
    // starts to get worse... in which case we stop the search (though we have
    // to move back to the prior position before finishing)
    if (newDiff > oldDiff) {
      retreat();
      break;
    }
    bestXPositionSoFar = xPosition;
  } while (advance());

  // We always expect to have moved one past the best match
  state.cursor = castDraft(nav.cursor);
  if (state.cursorVisualLineMovementXHint === undefined) {
    state.cursorVisualLineMovementXHint = targetXValue;
  }
  clearSelection(state);
}
