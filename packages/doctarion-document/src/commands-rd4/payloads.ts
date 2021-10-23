import { InteractorId } from "../working-document-rd4";

// -----------------------------------------------------------------------------
// Common command payload types.
// -----------------------------------------------------------------------------

export interface TargetPayload {
  readonly target?: Target;
}

/**
 * This is a payload that can be used for operations that change
 * interactors positions.
 */
export interface MovementPayload extends TargetPayload {
  readonly select?: boolean;
}

export enum InteractorTargets {
  Focused = "FOCUSED",
  All = "ALL",
  AllActive = "ALL_ACTIVE",
}

export type Target =
  | undefined // Defaults to focused
  | InteractorTargets
  | { readonly interactorId: InteractorId }
  | { readonly interactorIds: readonly InteractorId[] };

export const Target = {
  Focused: InteractorTargets.Focused,
  All: InteractorTargets.All,
  AllActive: InteractorTargets.AllActive,
};
