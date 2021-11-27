import { Side } from "../shared-utils";
import { CursorNavigator, CursorOrientation, NodeNavigator } from "../traversal";
import { ReadonlyWorkingInteractor, WorkingDocument } from "../working-document";

import { InteractorInputPosition, MovementPayload } from "./payloads";
import { CommandServices } from "./services";
import { coreCommand } from "./types";
import { CommandUtils } from "./utils";

import { SelectTargetsSort } from ".";

export const moveBack = coreCommand<MovementPayload>("cursor/moveBack", (state, services, payload): void => {
  for (const target of CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Unsorted)) {
    const n = target.mainAnchorNavigator;
    if (n.navigateToPrecedingCursorPosition()) {
      const p = {
        mainAnchor: state.getAnchorParametersFromCursorNavigator(n),
        lineMovementHorizontalVisualPosition: undefined,
      };
      if (payload.select && target.selectionAnchorCursor === undefined) {
        (p as any).selectionAnchor = state.getAnchorParametersFromCursorPath(target.mainAnchorCursor);
      } else if (!payload.select) {
        (p as any).selectionAnchor = undefined;
      }
      state.updateInteractor(target.interactor, p);
    }
  }
});

export const moveForward = coreCommand<MovementPayload>("cursor/moveForward", (state, services, payload): void => {
  for (const target of CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Unsorted)) {
    const n = target.mainAnchorNavigator;
    if (n.navigateToNextCursorPosition()) {
      const p = {
        mainAnchor: state.getAnchorParametersFromCursorNavigator(n),
        lineMovementHorizontalVisualPosition: undefined,
      };
      if (payload.select && target.selectionAnchorCursor === undefined) {
        (p as any).selectionAnchor = state.getAnchorParametersFromCursorPath(target.mainAnchorCursor);
      } else if (!payload.select) {
        (p as any).selectionAnchor = undefined;
      }
      state.updateInteractor(target.interactor, p);
    }
  }
});

export const moveVisualDown = coreCommand<MovementPayload>("cursor/moveVisualDown", (state, services, payload) => {
  if (!services.layout) {
    return;
  }

  for (const target of CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Unsorted)) {
    moveVisualUpOrDownHelper(state, services, "DOWN", target.interactor, target.mainAnchorNavigator);
  }
});

// export function moveLineDown(state: immer.Draft<EditorState>): void {
//   const nav = getCursorNavigatorAndValidate(state);
//   if (nav.navigateToPrecedingCursorPosition()) {
//     state.cursor = castDraft(nav.cursor);
//     clearSelection(state);
//     resetCursorMovementHints(state);
//   }
// }

export const moveVisualUp = coreCommand<MovementPayload>("cursor/moveVisualUp", (state, services, payload) => {
  if (!services.layout) {
    return;
  }

  for (const target of CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Unsorted)) {
    moveVisualUpOrDownHelper(state, services, "UP", target.interactor, target.mainAnchorNavigator);
  }
});

// export function moveLineUp(state: immer.Draft<EditorState>): void {
//   const nav = getCursorNavigatorAndValidate(state);
//   if (nav.navigateToPrecedingCursorPosition()) {
//     state.cursor = castDraft(nav.cursor);
//     clearSelection(state);
//     resetCursorMovementHints(state);
//   }
// }

export const jump = coreCommand<{ to: InteractorInputPosition } & MovementPayload>(
  "cursor/jump",
  (state, services, payload): void => {
    const to = CommandUtils.getAnchorParametersFromInteractorInputPosition(state, payload.to);

    for (const target of CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Unsorted)) {
      const p = {
        mainAnchor: to,
        lineMovementHorizontalVisualPosition: undefined,
      };
      if (payload.select && target.selectionAnchorCursor === undefined) {
        (p as any).selectionAnchor = state.getAnchorParametersFromCursorPath(target.mainAnchorCursor);
      } else if (!payload.select) {
        (p as any).selectionAnchor = undefined;
      }
      state.updateInteractor(target.interactor, p);
    }
  }
);

/**
 * This returns true if it updates the interactor.
 */
// An alternative implementation of this might use:
// https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint
// or
// https://developer.mozilla.org/en-US/docs/Web/API/Document/caretRangeFromPoint
function moveVisualUpOrDownHelper(
  state: WorkingDocument,
  services: CommandServices,
  direction: "UP" | "DOWN",
  interactor: ReadonlyWorkingInteractor,
  navigator: CursorNavigator
): void {
  const startNavigator = navigator.clone().toNodeNavigator();

  const targetAnchor =
    interactor.lineMovementHorizontalVisualPosition ??
    services.layout!.getTargetHorizontalPosition(
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
  let distance = services.layout!.detectHorizontalDistanceFrom(
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

      const newDistance = services.layout?.detectHorizontalDistanceFrom(
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
    mainAnchor: state.getAnchorParametersFromCursorNavigator(navigator),
    lineMovementHorizontalVisualPosition: undefined,
    selectionAnchor: undefined,
  });
}
