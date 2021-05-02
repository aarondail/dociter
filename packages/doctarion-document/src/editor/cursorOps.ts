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
    currentNavigator.toNodeNavigator(),
    currentNavigator.cursor.affinity === CursorAffinity.After ? Side.Right : Side.Left,
    targetAnchor
  );

  if (!distance) {
    return;
  }

  // console.log(distance);
  if (distance.estimatedSubjectSiblingsToTarget) {
    currentNavigator.navigateToRelativeSibling(
      distance.estimatedSubjectSiblingsToTarget,
      distance.estimatedSubjectSiblingSideClosestToTarget === Side.Left ? CursorAffinity.Before : CursorAffinity.After
    );
  } else {
    const newLineStartNavigator = currentNavigator.toNodeNavigator();

    while (advance()) {
      // console.log("curos:loop2:advance");
      if (didLineWrap(newLineStartNavigator)) {
        // console.log("curos:loop2:line wrap detected");
        retreat();
        break;
      }

      const newDistance = layout.detectHorizontalDistanceFromTargetHorizontalAnchor(
        currentNavigator.toNodeNavigator(),
        currentNavigator.cursor.affinity === CursorAffinity.After ? Side.Right : Side.Left,
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
        currentNavigator.navigateToRelativeSibling(
          newDistance.estimatedSubjectSiblingsToTarget,
          newDistance.estimatedSubjectSiblingSideClosestToTarget === Side.Left
            ? CursorAffinity.Before
            : CursorAffinity.After
          // direction === "DOWN" ? CursorAffinity.Before : CursorAffinity.After
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
