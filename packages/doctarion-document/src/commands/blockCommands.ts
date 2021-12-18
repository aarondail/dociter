import { NodeCategory, NodeChildrenType } from "../document-model";
import { NodeTemplate, ReadonlyWorkingNode } from "../working-document";

import { CommandError } from "./error";
import { TargetPayload } from "./payloads";
import { coreCommand } from "./types";
import { CommandUtils, SelectTargetsSort } from "./utils";

export interface ChangeBlockTypeOptions {
  readonly template: NodeTemplate;
}

export type ChangeBlockTypePayload = TargetPayload & ChangeBlockTypeOptions;

export const changeBlockType = coreCommand<ChangeBlockTypePayload>("changeBlockType", (state, services, payload) => {
  const targets = CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Reversed);

  if (
    payload.template.nodeType.category !== NodeCategory.Block ||
    payload.template.nodeType.childrenType !== NodeChildrenType.Inlines
  ) {
    throw new CommandError(
      "Cannot change blocks to a non-block node type, or a node type that does not have inlines as children."
    );
  }

  const blocks = new Set<ReadonlyWorkingNode>();
  for (const target of targets) {
    if (target.selectionAnchorNavigator) {
      CommandUtils.walkBlocksInSelectionTarget(
        state,
        target,
        (n) =>
          (n.tip.node as ReadonlyWorkingNode).nodeType.childrenType === NodeChildrenType.Inlines &&
          blocks.add(n.tip.node as ReadonlyWorkingNode)
      );
    } else {
      // Change the whole node being pointed to
      const n = CommandUtils.findAncestorBlockNodeWithNavigator(target.mainAnchorNavigator);
      if (!n) {
        continue;
      }
      const node = n.node;
      if (node.nodeType.childrenType === NodeChildrenType.Inlines) {
        blocks.add(node);
      }
    }
  }

  for (const block of blocks.values()) {
    state.changeNodeTypeAndFacets(block, payload.template);
  }
});
