/* eslint-disable @typescript-eslint/unbound-method */
import { Node, NodeCategory } from "../document-model-rd4";
import { SimpleComparison } from "../miscUtils";
import {
  CursorNavigator,
  CursorOrientation,
  CursorPath,
  NodeNavigator,
  Path,
  PseudoNode,
  Range,
  ReadonlyCursorNavigator,
  ReadonlyNodeNavigator,
} from "../traversal-rd4";
import {
  AnchorParameters,
  InteractorId,
  InteractorStatus,
  ReadonlyInteractor,
  ReadonlyWorkingNode,
  WorkingDocument,
} from "../working-document-rd4";

import { CommandError } from "./error";
import { Direction, InteractorInputPosition, InteractorTargets, Target } from "./payloads";

export type SelectTargetsResult = {
  readonly interactor: ReadonlyInteractor;
  readonly mainAnchorCursor: CursorPath;
  readonly mainAnchorNavigator: CursorNavigator<ReadonlyWorkingNode>;
  readonly selectionAnchorCursor?: CursorPath;
  readonly selectionAnchorNavigator?: CursorNavigator<ReadonlyWorkingNode>;
  // This could be lazily calculated...
  readonly selectionRange?: Range;
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

  findAncestorNodeWithNavigator(
    startingNavigator: ReadonlyNodeNavigator<ReadonlyWorkingNode> | ReadonlyCursorNavigator<ReadonlyWorkingNode>,
    predicateOrNode: PseudoNode | ((node: PseudoNode) => boolean)
  ): { path: Path; node: ReadonlyWorkingNode } | undefined {
    const n: NodeNavigator<ReadonlyWorkingNode> =
      startingNavigator instanceof NodeNavigator
        ? startingNavigator.clone()
        : (startingNavigator as ReadonlyCursorNavigator<ReadonlyWorkingNode>).toNodeNavigator();

    if (typeof predicateOrNode === "function") {
      if (n.navigateToAncestorMatchingPredicate(predicateOrNode)) {
        // if (CommandUtils.isPseudoNodeABlock(n.tip.node)) {
        return { path: n.path, node: n.tip.node as ReadonlyWorkingNode };
      }
    } else {
      if (n.navigateToAncestor(predicateOrNode)) {
        // if (CommandUtils.isPseudoNodeABlock(n.tip.node)) {
        return { path: n.path, node: n.tip.node as ReadonlyWorkingNode };
      }
    }
    return undefined;
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

  isCursorNavigatorAtEdgeOfBlock(
    navigator: ReadonlyCursorNavigator<ReadonlyWorkingNode>,
    direction: Direction
  ): boolean {
    const block = CommandUtils.findAncestorNodeWithNavigator(navigator, CommandUtils.isPseudoNodeABlock);
    if (!block) {
      return false;
    }

    const n = navigator.clone();
    if (
      (direction === Direction.Backward && !n.navigateToPrecedingCursorPosition()) ||
      (direction === Direction.Forward && !n.navigateToNextCursorPosition())
    ) {
      return true;
    }

    const newBlockMaybe = CommandUtils.findAncestorNodeWithNavigator(n, CommandUtils.isPseudoNodeABlock);
    return block !== newBlockMaybe;
  },

  isCursorNavigatorAtEdgeOfContainingNode(
    navigator: ReadonlyCursorNavigator<ReadonlyWorkingNode>,
    containingNode: ReadonlyWorkingNode,
    direction: Direction
  ): boolean {
    const firstFind = CommandUtils.findAncestorNodeWithNavigator(navigator, containingNode);
    if (!firstFind) {
      return false;
    }

    const n = navigator.clone();
    if (
      (direction === Direction.Backward && !n.navigateToPrecedingCursorPosition()) ||
      (direction === Direction.Forward && !n.navigateToNextCursorPosition())
    ) {
      return true;
    }

    const secondFind = CommandUtils.findAncestorNodeWithNavigator(n, containingNode);
    return firstFind !== secondFind;
  },

  isPseudoNodeAnInlineOrGraphemeOrFancyGrapheme(node: PseudoNode): boolean {
    return node instanceof Node && node.nodeType.category === NodeCategory.Inline;
  },

  isPseudoNodeABlock(node: PseudoNode): boolean {
    return node instanceof Node && node.nodeType.category === NodeCategory.Block;
  },

  isPseudoNodeABlockContainer(node: PseudoNode): boolean {
    return node instanceof Node && node.nodeType.hasBlockChildren();
  },

  isPseudoNodeAnInlineContainer(node: PseudoNode): boolean {
    return node instanceof Node && node.nodeType.hasInlineChildren();
  },

  isPseudoNodeATextOrFancyTextContainer(node: PseudoNode): boolean {
    return node instanceof Node && node.nodeType.hasTextOrFancyTextChildren();
  },

  selectTargets(state: WorkingDocument, target: Target, sort?: boolean): SelectTargetsResult[] {
    // TODO get rid of firstCursor at some point

    const results: SelectTargetsResult[] = getTargetedInteractors(target, state).map(
      (interactor: ReadonlyInteractor) => {
        const navigators = state.getCursorNavigatorsForInteractor(interactor);
        const mainAnchorCursor = navigators.mainAnchor.cursor;
        const selectionAnchorCursor = navigators.selectionAnchor ? navigators.selectionAnchor.cursor : undefined;
        const isMainCursorFirst = selectionAnchorCursor
          ? mainAnchorCursor.compareTo(selectionAnchorCursor) !== SimpleComparison.After
          : true;
        const selectionRange = navigators.selectionAnchor
          ? getRangeForSelection(
              state,
              isMainCursorFirst ? navigators.mainAnchor : navigators.selectionAnchor,
              isMainCursorFirst ? navigators.selectionAnchor : navigators.mainAnchor
            )
          : undefined;
        return {
          interactor,
          mainAnchorCursor,
          mainAnchorNavigator: navigators.mainAnchor,
          selectionAnchorCursor,
          selectionAnchorNavigator: navigators.selectionAnchor,
          selectionRange,
          isMainCursorFirst,
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

function getRangeForSelection(state: WorkingDocument, from: CursorNavigator, to: CursorNavigator): Range | undefined {
  let fromPath = from.path;
  if (from.cursor.orientation === CursorOrientation.After) {
    const n = from.toNodeNavigator();
    if (n.navigateForwardsByDfs()) {
      fromPath = n.path;
    }
  }

  let toPath = to.path;
  if (to.cursor.orientation === CursorOrientation.Before) {
    const n = to.toNodeNavigator();
    if (n.navigateBackwardsByDfs()) {
      toPath = n.path;
    }
  }

  return new Range(fromPath, toPath);
}
