import { Draft } from "immer";

import { InteractorId, InteractorStatus } from "../editor";

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

export type OperationTarget =
  | undefined // Defaults to focused
  | TargetInteractors
  | { readonly interactorId: InteractorId }
  | { readonly interactorIds: readonly InteractorId[] };

/**
 * Note this always returns the targeted interactor ids in the order they are
 * found in `interactors.ordered`.
 */
export function getTargetedInteractorIds(
  // identifier: OperationInteractorTarget,
  target: OperationTarget,
  state: Draft<EditorState>
): readonly InteractorId[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
  const untypedIdentifier = target as any;

  if (target === undefined) {
    if (state.focusedInteractorId) {
      return [state.focusedInteractorId];
    }
  } else if (typeof target === "string") {
    switch (target) {
      case TargetInteractors.All:
        return Object.values(state.interactors).map((e) => e.id);
      case TargetInteractors.AllActive:
        return Object.values(state.interactors)
          .filter((e) => e.status === InteractorStatus.Active)
          .map((e) => e.id);
      case TargetInteractors.Focused:
        if (state.focusedInteractorId) {
          return [state.focusedInteractorId];
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  } else if (untypedIdentifier.interactorId !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return [untypedIdentifier.interactorId];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  } else if (untypedIdentifier.interactorIds !== undefined) {
    return (
      Object.values(state.interactors)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        .filter((e) => untypedIdentifier.interactorIds.includes(e.id))
        .map((e) => e.id)
    );
  }
  return [];
}
