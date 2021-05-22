import { Cursor } from "../cursor";
import { InteractorId, Range } from "../interactor";

export enum InteractorTarget {
  Focused = "FOCUSED",
  All = "ALL",
  AllActive = "ALL_ACTIVE",
}

/**
 * This is a payload that can be used for an operation that changes
 * interactors.
 */
export interface MovementTargetPayload {
  readonly select?: boolean;
  readonly target?:
    | undefined // Defaults to focused
    | InteractorTarget
    | { readonly interactorId: InteractorId }
    | { readonly interactorIds: readonly InteractorId[] };
}

/**
 * This is a payload that can be used for an operation that changes the
 * document.
 */
export interface TargetPayload {
  readonly target?:
    | undefined // Defaults to focused
    | InteractorTarget
    | { readonly interactorId: InteractorId }
    | { readonly interactorIds: readonly InteractorId[] }
    | Cursor
    | { readonly cursors: readonly Cursor[] }
    | Range
    | { readonly ranges: readonly Range[] };
}
