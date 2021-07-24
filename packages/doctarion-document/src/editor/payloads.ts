import { OperationTarget } from "./target";

// -----------------------------------------------------------------------------
// Common, base, operation payload types.
// -----------------------------------------------------------------------------

/**
 * This is a payload that can be used for operations that change
 * interactors positions.
 */
export interface InteractorMovementPayload {
  readonly select?: boolean;
  readonly target?: OperationTarget;
}

/**
 * This payload can be used for operations that accept any kind of target. One
 * or more interactors, cursors, or ranges.
 */
export interface AnyTargetPayload {
  readonly target?: OperationTarget;
}
