import { Draft } from "immer";

import { InteractorId, InteractorStatus } from "../working-document";

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

export function getTargetedInteractorIds(
  // identifier: OperationInteractorTarget,
  target: OperationTarget,
  state: Draft<EditorState>
): readonly InteractorId[] {
  const untypedIdentifier = target as any;

  if (target === undefined) {
    if (state.focusedInteractorId) {
      return [state.focusedInteractorId];
    }
  } else if (typeof target === "string") {
    switch (target) {
      case TargetInteractors.All:
        return state.getAllInteractors().map((e) => e.id);
      case TargetInteractors.AllActive:
        return state
          .getAllInteractors()
          .filter((e) => e.status === InteractorStatus.Active)
          .map((e) => e.id);
      case TargetInteractors.Focused:
        if (state.focusedInteractorId) {
          return [state.focusedInteractorId];
        }
    }
  } else if (untypedIdentifier.interactorId !== undefined) {
    return [untypedIdentifier.interactorId];
  } else if (untypedIdentifier.interactorIds !== undefined) {
    return state
      .getAllInteractors()
      .filter((e) => untypedIdentifier.interactorIds.includes(e.id))
      .map((e) => e.id);
  }
  return [];
}
