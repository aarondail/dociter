import { InteractorId, InteractorOrderingEntryCursorType, InteractorStatus } from "../working-document";

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
  state: EditorState
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
        return state.interactorOrdering
          .filter((e) => e.cursorType === InteractorOrderingEntryCursorType.Main)
          .map((e) => e.id);
      case TargetInteractors.AllActive:
        // eslint-disable-next-line no-case-declarations
        const ids: InteractorId[] = [];
        state.interactorOrdering
          .filter((e) => e.cursorType === InteractorOrderingEntryCursorType.Main)
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  } else if (untypedIdentifier.interactorId !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return [untypedIdentifier.interactorId];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  } else if (untypedIdentifier.interactorIds !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return state.interactorOrdering.filter((e) => untypedIdentifier.interactorIds.includes(e.id)).map((e) => e.id);
  }
  return [];
}
