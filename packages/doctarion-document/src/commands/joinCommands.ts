import { FlowDirection } from "../shared-utils";
import { LiftingPathMap } from "../traversal";
import { NodeTemplate, ReadonlyWorkingNode } from "../working-document";

import { TargetPayload } from "./payloads";
import { coreCommand } from "./types";
import { CommandUtils, SelectTargetsSort } from "./utils";

export enum JoinType {
  Blocks = "BLOCKS",
}

interface JoinOptions {
  /**
   * By default joins between different types of nodes are prohibited. If this
   * is set to true, the node types will be changed to be the same, if possible.
   * The node that is being joined *into* will be the type that the final joined
   * node will have.
   */
  readonly allowNodeTypeCoercion: boolean;
  /**
   * Note for selections this doesn't affect which blocks will be joined, but it
   * does affect whether the children are joined into the first selected block,
   * or the last.
   */
  readonly direction: FlowDirection;

  readonly type: JoinType;
}

export type JoinPayload = TargetPayload & Partial<Omit<JoinOptions, "type">> & Pick<JoinOptions, "type">;

/**
 * This joins the block the target nodes are in, *into* their sibling blocks.
 */
export const joinInto = coreCommand<JoinPayload>("joinInto", (state, services, payload) => {
  const direction = payload.direction ?? FlowDirection.Backward;

  const targets = CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Forward);

  // Not really sure we need to do this... vs. just iterating through the
  // targets and processing them immediately
  const toJoin = new LiftingPathMap<{ readonly node: ReadonlyWorkingNode }>();

  for (const target of targets) {
    // Skip any interactor (or throw error) if the interactor is a selection (for now)
    if (target.selectionAnchorNavigator) {
      CommandUtils.walkBlocksInSelectionTarget(state, target, (n, { start, end }) => {
        // Skip the start block if we are going backwards, or the end block if
        // we are going forwards
        if (direction === FlowDirection.Backward && n.tip.node === start) {
          // Skip
        } else if (direction === FlowDirection.Forward && n.tip.node === end) {
          // Skip
        } else {
          toJoin.add(n.path, { node: n.tip.node as ReadonlyWorkingNode });
        }
      });
    } else {
      const n = CommandUtils.findAncestorBlockNodeWithNavigator(target.mainAnchorNavigator);
      if (n) {
        toJoin.add(n.path, { node: n.node });
      }
    }
  }

  const toJoinElements = toJoin.getAllOrderedByPaths();
  toJoinElements.reverse();
  for (const { elements } of toJoinElements) {
    const sourceNode = elements[0]!.node;

    const n = state.getNodeNavigator(sourceNode);

    if (!(direction === FlowDirection.Backward ? n.navigateToPrecedingSibling() : n.navigateToNextSibling())) {
      continue;
    }
    const destinationNode = n.tip.node as ReadonlyWorkingNode;

    if (sourceNode.nodeType !== destinationNode?.nodeType && payload.allowNodeTypeCoercion) {
      // If the sourceNode has any anchor or node facets this will definitely fail
      state.changeNodeTypeAndFacets(sourceNode, new NodeTemplate(destinationNode.nodeType, destinationNode.facets));
    }

    const flippedDirection = direction === FlowDirection.Backward ? FlowDirection.Forward : FlowDirection.Backward;
    state.joinSiblingIntoNode(destinationNode, flippedDirection);
  }
});
