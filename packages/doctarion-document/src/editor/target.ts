/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Range } from "../basic-traversal";
import { Cursor } from "../cursor";

import { InteractorId, InteractorOrderingEntryCursor, InteractorStatus } from "./interactor";
import { EditorState } from "./state";

// -----------------------------------------------------------------------------
// Types that can be used in operation payloads to identify interactors,
// document positions, and ranges to operate on.
//
// There are also helper functions to make working with these types easy.
// -----------------------------------------------------------------------------

export enum TargetInteractors {
  Focused = "FOCUSED",
  All = "ALL",
  AllActive = "ALL_ACTIVE",
}

export type OperationInteractorTarget =
  | undefined // Defaults to focused
  | TargetInteractors
  | { readonly interactorId: InteractorId }
  | { readonly interactorIds: readonly InteractorId[] };

export type OperationCursorTarget = Cursor | { readonly cursors: readonly Cursor[] };
export type OperationRangeTarget = Range | { readonly ranges: readonly Range[] };
export type OperationNonInteractorTarget = OperationCursorTarget | OperationCursorTarget;

export type OperationTarget = OperationInteractorTarget | OperationNonInteractorTarget;

export function isOperationInteractorTarget(target: OperationTarget): target is OperationInteractorTarget {
  const untypedTarget = target as any;
  return (
    target === undefined ||
    // Maybe this should more specifically check whether identifier matches one
    // of the `TargetIdentifiers`...
    typeof target === "string" ||
    untypedTarget.interactorId !== undefined ||
    untypedTarget.interactorIds !== undefined
  );
}

/**
 * Note this always returns the targeted interactor ids in the order they are
 * found in `interactors.ordered`.
 */
export function getTargetedInteractorIds(
  identifier: OperationInteractorTarget,
  state: EditorState
): readonly InteractorId[] {
  const untypedIdentifier = identifier as any;

  if (identifier === undefined) {
    if (state.focusedInteractorId) {
      return [state.focusedInteractorId];
    }
  } else if (typeof identifier === "string") {
    switch (identifier) {
      case TargetInteractors.All:
        return state.interactorOrdering.filter((e) => e.cursor === InteractorOrderingEntryCursor.Main).map((e) => e.id);
      case TargetInteractors.AllActive:
        // eslint-disable-next-line no-case-declarations
        const ids: InteractorId[] = [];
        state.interactorOrdering
          .filter((e) => e.cursor === InteractorOrderingEntryCursor.Main)
          .map((e) => e.id)
          .forEach((id) => {
            const interactor = state.interactors[id];
            if (interactor.status === InteractorStatus.Active) {
              ids.push(id);
            }
          });
        return ids;
      case TargetInteractors.Focused:
        if (state.focusedInteractorId) {
          return [state.focusedInteractorId];
        }
    }
  } else if (untypedIdentifier.interactorId !== undefined) {
    return [untypedIdentifier.interactorId];
  } else if (untypedIdentifier.interactorIds !== undefined) {
    return state.interactorOrdering.filter((e) => untypedIdentifier.interactorIds.includes(e.id)).map((e) => e.id);
  }
  return [];
}

export function isOperationCursorTarget(identifier: OperationTarget): identifier is OperationCursorTarget {
  const untypedIdentifier = identifier as any;
  return identifier instanceof Cursor || untypedIdentifier.cursors !== undefined;
}

export function getTargetedCursors(identifier: OperationCursorTarget): readonly Cursor[] {
  const untypedIdentifier = identifier as any;
  if (untypedIdentifier.cursors !== undefined) {
    return untypedIdentifier.cursors;
  } else if (identifier instanceof Cursor) {
    return [identifier];
  }
  return [];
}
