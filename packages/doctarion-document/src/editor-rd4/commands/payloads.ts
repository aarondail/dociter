import { Cursor, CursorNavigator } from "../../cursor-traversal-rd4";
import { SimpleComparison } from "../../miscUtils";
import { InteractorId, InteractorStatus } from "../../working-document";
import { ReadonlyInteractor, WorkingDocument } from "../../working-document-rd4";

// -----------------------------------------------------------------------------
// Common command payload, and supporting, types.
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

function getTargetedInteractors(target: Target, state: WorkingDocument): readonly ReadonlyInteractor[] {
  const untypedIdentifier = target as any;

  if (target === undefined) {
    if (state.focusedInteractor) {
      return [state.focusedInteractor];
    }
  } else if (typeof target === "string") {
    switch (target) {
      case InteractorTargets.All:
        return Array.from(state.interactors.values());
      case InteractorTargets.AllActive:
        return Array.from(state.interactors.values()).filter((e) => e.status === InteractorStatus.Active);
      case InteractorTargets.Focused:
        if (state.focusedInteractor) {
          return [state.focusedInteractor];
        }
    }
  } else if (untypedIdentifier.interactorId !== undefined) {
    return [untypedIdentifier.interactorId];
  } else if (untypedIdentifier.interactorIds !== undefined) {
    return Array.from(state.interactors.values()).filter((e) => untypedIdentifier.interactorIds.includes(e.id));
  }
  return [];
}

export type SelectTargetsResult =
  | { isSelection: false; interactor: ReadonlyInteractor; navigator: CursorNavigator }
  | {
      isSelection: true;
      interactor: ReadonlyInteractor;
      navigators: [CursorNavigator, CursorNavigator];
      isMainCursorFirst: boolean;
    };

export function selectTargets(
  state: WorkingDocument,
  // services: EditorOperationServices,
  target: Target,
  sort?: boolean
): SelectTargetsResult[] {
  // TODO get rid of firstCursor at some point
  const result: (SelectTargetsResult & { firstCursor: Cursor | undefined })[] = [];

  const recordResult = (interactor: ReadonlyInteractor) => {
    if (interactor.selectionAnchor !== undefined) {
      const r = getBothCursorNavigatorsForSelection(interactor, state, services);
      if (r) {
        result.push({
          isSelection: true,
          interactor,
          ...r,
          firstCursor: sort ? (r.isMainCursorFirst ? r.navigators[0].cursor : r.navigators[1].cursor) : undefined,
        });
      }
    } else {
      const nav = getMainCursorNavigatorFor(interactor, state, services);
      result.push({ isSelection: false, interactor, navigator: nav, firstCursor: sort ? nav.cursor : undefined });
    }
  };

  getTargetedInteractors(target, state).forEach(recordResult);

  if (sort && result.length > 1) {
    result.sort((left, right) => {
      const cmp = left.firstCursor!.compareTo(right.firstCursor!);
      switch (cmp) {
        case SimpleComparison.Before:
          return -1;
        case SimpleComparison.After:
          return 1;
        default:
          return 0;
      }
    });
  }
  return result;
}
