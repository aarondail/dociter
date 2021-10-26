import { SimpleComparison } from "../miscUtils";
import { CursorNavigator, CursorPath, Path } from "../traversal-rd4";
import {
  AnchorParameters,
  InteractorId,
  InteractorStatus,
  ReadonlyInteractor,
  ReadonlyWorkingNode,
  WorkingDocument,
} from "../working-document-rd4";

import { CommandError } from "./error";
import { InteractorInputPosition, InteractorTargets, Target } from "./payloads";

export type SelectTargetsResult = {
  readonly interactor: ReadonlyInteractor;
  readonly mainAnchorCursor: CursorPath;
  readonly mainAnchorNavigator: CursorNavigator<ReadonlyWorkingNode>;
  readonly selectionAnchorCursor?: CursorPath;
  readonly selectionAnchorNavigator?: CursorNavigator<ReadonlyWorkingNode>;
  readonly isMainCursorFirst: boolean;
};

export const CommandUtils = {
  /**
   * There definitely could be more situations in which we want to dedupe
   * interactors, but for right now we only dedupe interactors that aren't a
   * selection AND have the same status AND their mainCursor is equal.
   *
   * This must be called after the interactorOrdering has been sorted.
   */
  dedupeInteractors(state: WorkingDocument): InteractorId[] | undefined {
    const interactors = state.interactors;
    if (interactors.size < 2) {
      return;
    }

    // Try to remove any interactors that are exact matches for another
    // interactor, but only consider NON-selections. Its unclear at this
    // point what the best behavior for selections would be.
    let dupeIds: InteractorId[] | undefined;
    const seenKeys = new Set<string>();
    for (const [, i] of interactors) {
      if (i.selectionAnchor) {
        continue;
      }
      const key = `${i.mainAnchor.node.id}${i.mainAnchor.orientation}${i.mainAnchor.graphemeIndex || ""}${i.status}`;
      if (seenKeys.has(key)) {
        if (!dupeIds) {
          dupeIds = [];
        }
        dupeIds.push(i.id);
      }
      seenKeys.add(key);
    }

    if (dupeIds) {
      for (const id of dupeIds) {
        state.deleteInteractor(id);
      }
    }
    return dupeIds;
  },

  getAnchorParametersFromInteractorInputPosition(
    state: WorkingDocument,
    position: InteractorInputPosition
  ): AnchorParameters {
    const n = new CursorNavigator(state.document);
    const cursor =
      position instanceof CursorPath
        ? position
        : new CursorPath(
            position.path instanceof Path ? position.path : Path.parse(position.path),
            position.orientation
          );
    if (!cursor || !n.navigateTo(cursor)) {
      throw new CommandError("Invalid InteractorInputPosition");
    }
    return state.getAnchorParametersFromCursorNavigator(n);
  },

  selectTargets(state: WorkingDocument, target: Target, sort?: boolean): SelectTargetsResult[] {
    // TODO get rid of firstCursor at some point

    const results: SelectTargetsResult[] = getTargetedInteractors(target, state).map(
      (interactor: ReadonlyInteractor) => {
        const navigators = state.getCursorNavigatorsForInteractor(interactor);
        const mainAnchorCursor = navigators.mainAnchor.cursor;
        const selectionAnchorCursor = navigators.selectionAnchor ? navigators.selectionAnchor.cursor : undefined;
        return {
          interactor,
          mainAnchorCursor,
          mainAnchorNavigator: navigators.mainAnchor,
          selectionAnchorCursor,
          selectionAnchorNavigator: navigators.selectionAnchor,
          isMainCursorFirst: selectionAnchorCursor
            ? mainAnchorCursor.compareTo(selectionAnchorCursor) !== SimpleComparison.After
            : true,
        };
      }
    );

    if (sort && results.length > 1) {
      results.sort((left, right) => {
        const leftFirstCursor = left.isMainCursorFirst ? left.mainAnchorCursor : left.selectionAnchorCursor!;
        const rightFirstCursor = right.isMainCursorFirst ? right.mainAnchorCursor : right.selectionAnchorCursor!;
        const cmp = leftFirstCursor.compareTo(rightFirstCursor);
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
    return results;
  },
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
