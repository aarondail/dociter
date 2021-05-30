/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Range } from "../basic-traversal";
import { Cursor } from "../cursor";
import { InteractorId, InteractorSet, InteractorStatus } from "../interactor";

// -----------------------------------------------------------------------------
// Types to identify interactors to operate on, for use in operations, as well
// as types that identify positions and ranges to operate on.
//
// There are additional helper functions to make working with these types easy.
// -----------------------------------------------------------------------------

export enum InteractorTarget {
  Focused = "FOCUSED",
  All = "ALL",
  AllActive = "ALL_ACTIVE",
}

export type InteractorTargetIdentifier =
  | undefined // Defaults to focused
  | InteractorTarget
  | { readonly interactorId: InteractorId }
  | { readonly interactorIds: readonly InteractorId[] };

export type NonInteractorNonSelectionTargetIdentifier = Cursor | { readonly cursors: readonly Cursor[] };
export type NonInteractorSelectionTargetIdentifier = Range | { readonly ranges: readonly Range[] };
export type NonInteractorTargetIdentifier =
  | NonInteractorNonSelectionTargetIdentifier
  | NonInteractorNonSelectionTargetIdentifier;

export function isInteractorTargetIdentifier(
  identifier: InteractorTargetIdentifier | NonInteractorTargetIdentifier
): identifier is InteractorTargetIdentifier {
  const untypedIdentifier = identifier as any;
  return (
    identifier === undefined ||
    typeof identifier === "string" ||
    untypedIdentifier.interactorId !== undefined ||
    untypedIdentifier.interactorIds !== undefined
  );
}

/**
 * Note this always returns the targeted interactor ids in the order they are in
 * in `interactors.ordered`.
 */
export function getIdentifiedInteractorIds(
  identifier: InteractorTargetIdentifier,
  interactors: InteractorSet
): readonly InteractorId[] {
  const untypedIdentifier = identifier as any;

  if (identifier === undefined) {
    if (interactors.focusedId) {
      return [interactors.focusedId];
    }
  } else if (typeof identifier === "string") {
    switch (identifier) {
      case InteractorTarget.All:
        return interactors.ordered;
      case InteractorTarget.AllActive:
        // eslint-disable-next-line no-case-declarations
        const ids = [];
        for (let i = 0; i < interactors.ordered.length; i++) {
          const id = interactors.ordered[i];
          const interactor = interactors.byId[id];
          if (interactor.status === InteractorStatus.Active) {
            ids.push(id);
          }
        }
        return ids;
      case InteractorTarget.Focused:
        if (interactors.focusedId) {
          return [interactors.focusedId];
        }
    }
  } else if (untypedIdentifier.interactorId !== undefined) {
    return [untypedIdentifier.interactorId];
  } else if (untypedIdentifier.interactorIds !== undefined) {
    return interactors.ordered.filter((x: InteractorId) => untypedIdentifier.interactorIds.includes(x));
  }
  return [];
}

export function isNonInteractorNonSelectionTargetIdentifier(
  identifier: InteractorTargetIdentifier | NonInteractorTargetIdentifier
): identifier is NonInteractorNonSelectionTargetIdentifier {
  const untypedIdentifier = identifier as any;
  return identifier instanceof Cursor || untypedIdentifier.cursors !== undefined;
}

export function getIdentifierCursors(identifier: NonInteractorNonSelectionTargetIdentifier): readonly Cursor[] {
  const untypedIdentifier = identifier as any;
  if (untypedIdentifier.cursors !== undefined) {
    return untypedIdentifier.cursors;
  } else if (identifier instanceof Cursor) {
    return [identifier];
  }
  return [];
}

// -----------------------------------------------------------------------------
// Target payload types that use the above target identifer types
// -----------------------------------------------------------------------------

/**
 * This is a payload that can be used for an operation that changes
 * interactors.
 */
export interface MovementTargetPayload {
  readonly select?: boolean;
  readonly target?: InteractorTargetIdentifier;
}

/**
 * This is a payload that can be used for operations that work on selections as
 * well as non-selections, both as interactors and as arbitrary document
 * locations.
 */
export interface AllTargetPayload {
  readonly target?: InteractorTargetIdentifier | NonInteractorTargetIdentifier;
}

/**
 * This is a payload that can be used for operations that work on non-selections
 * only, but can work on both interactors as well as arbitrary document
 * locations.
 */
export interface NonSelectionTargetPayload {
  readonly target?: InteractorTargetIdentifier | NonInteractorNonSelectionTargetIdentifier;
}
