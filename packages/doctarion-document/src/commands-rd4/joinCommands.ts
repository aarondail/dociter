/* eslint-disable @typescript-eslint/unbound-method */
import { LiftingPathMap, Range } from "../traversal-rd4";
import { JoinDirection, ReadonlyWorkingNode } from "../working-document-rd4";

import { Direction, TargetPayload } from "./payloads";
import { coreCommand } from "./types";
import { CommandUtils } from "./utils";

export enum JoinType {
  Blocks = "BLOCKS",
}
interface JoinOptions {
  readonly type: JoinType;
  /**
   * Note for selections this doesn't affect which blocks will be joined, but it
   * does affect whether the children are joined into the first selected block,
   * or the last.
   */
  readonly direction: Direction;
}

export type JoinPayload = TargetPayload & Partial<JoinOptions>;

export const join = coreCommand<JoinPayload>("join", (state, services, payload) => {
  const direction = payload.direction ?? Direction.Backward;

  const targets = CommandUtils.selectTargets(state, payload.target);

  // Not really sure we need to do this... vs. just iterating through the
  // targets and processing them immediately
  const toJoin = new LiftingPathMap<{ readonly node: ReadonlyWorkingNode }>();

  for (const target of targets) {
    // Skip any interactor (or throw error) if the interactor is a selection (for now)
    if (target.selectionAnchorNavigator) {
      const [startNav, endNav] = target.isMainCursorFirst
        ? [target.mainAnchorNavigator, target.selectionAnchorNavigator]
        : [target.selectionAnchorNavigator, target.mainAnchorNavigator];

      const start = CommandUtils.findAncestorNodeWithNavigator(startNav, CommandUtils.isPseudoNodeABlock);
      const end = CommandUtils.findAncestorNodeWithNavigator(endNav, CommandUtils.isPseudoNodeABlock);
      if (!start || !end) {
        break;
      }

      new Range(start.path, end.path).walk<ReadonlyWorkingNode>(
        state.document,
        (n) => {
          // Skip the start block if we are going backwards, or the end block if
          // we are going forwards
          if (direction === Direction.Backward && n.path.equalTo(start.path)) {
            // Skip
          } else if (direction === Direction.Forward && n.path.equalTo(end.path)) {
            // Skip
          } else {
            toJoin.add(n.path, { node: n.tip.node as ReadonlyWorkingNode });
          }
        },
        CommandUtils.isPseudoNodeAnInlineOrGraphemeOrFancyGrapheme,
        CommandUtils.isPseudoNodeAnInlineOrGraphemeOrFancyGrapheme
      );
    } else {
      const n = CommandUtils.findAncestorNodeWithNavigator(target.mainAnchorNavigator, CommandUtils.isPseudoNodeABlock);
      if (n) {
        toJoin.add(n.path, { node: n.node });
      }
    }
  }

  const toJoinElements = toJoin.getAllOrderedByPaths();
  toJoinElements.reverse();
  for (const { elements } of toJoinElements) {
    const sourceNode = elements[0]!.node;
    state.joinSiblingIntoNode(
      sourceNode,
      direction === Direction.Backward ? JoinDirection.Backward : JoinDirection.Forward
    );
  }
});
