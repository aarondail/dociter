import { OperationCursorTarget, OperationInteractorTarget, OperationTarget } from "./target";

// -----------------------------------------------------------------------------
// Common, base, operation payload types.
// -----------------------------------------------------------------------------

/**
 * This is a payload that can be used for operations that change
 * interactors positions.
 */
export interface InteractorMovementPayload {
  readonly select?: boolean;
  readonly target?: OperationInteractorTarget;
}

/**
 * This payload can be used for operations that accept any kind of target. One
 * or more interactors, cursors, or ranges.
 */
export interface AnyTargetPayload {
  readonly target?: OperationTarget;
}

/**
 * This is a payload that can be used for operations that work on non-selections
 * only, but can work on both interactors as well as arbitrary document
 * positions.
 */
export interface CursorTargetPayload {
  readonly target?: OperationInteractorTarget | OperationCursorTarget;
}
