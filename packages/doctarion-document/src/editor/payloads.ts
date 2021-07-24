import { OperationTarget } from "./target";

// -----------------------------------------------------------------------------
// Common, base, operation payload types.
// -----------------------------------------------------------------------------

export interface TargetPayload {
  readonly target?: OperationTarget;
}

/**
 * This is a payload that can be used for operations that change
 * interactors positions.
 */
export interface InteractorMovementPayload extends TargetPayload {
  readonly select?: boolean;
}
