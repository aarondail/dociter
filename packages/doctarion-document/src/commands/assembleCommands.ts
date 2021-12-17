import { NodeCategory, NodeChildrenType } from "../document-model";
import { FancyGrapheme, Text } from "../text-model";
import { PseudoNode } from "../traversal";
import { NodeTemplate } from "../working-document";

import { deleteImplementation } from "./deletionCommands";
import { CommandError } from "./error";
import { insert } from "./insertionCommands";
import { TargetPayload } from "./payloads";
import { coreCommand } from "./types";
import { CommandUtils, SelectTargetsSort } from "./utils";

export interface AssembleOptions {
  // readonly type: AssembleType;
  readonly template: NodeTemplate;
}

export type AssemblePayload = TargetPayload & AssembleOptions;

export const assemble = coreCommand<AssemblePayload>("assemble", (state, services, payload) => {
  const targets = CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Reversed);

  if (payload.template.nodeType.category !== NodeCategory.Inline) {
    throw new CommandError("Cannot assemble inlines to a non-inline node type");
  } else if (payload.template.nodeType.childrenType !== NodeChildrenType.FancyText) {
    // Maybe implement this behavior rather than error out?
    throw new CommandError("Cannot assemble inlines to a node type that does not have fancy text as children");
  }

  for (const target of targets) {
    if (target.selectionAnchorNavigator) {
      // Convert all contained inlines
      const text: FancyGrapheme[] = [];
      CommandUtils.walkInlineGraphemeRangesInSelectionTarget(
        state,
        target,
        (nodeChain, facet, graphemeRangeInclusive) => {
          if (
            PseudoNode.isNode(nodeChain.tipNode) &&
            nodeChain.tipNode.nodeType.childrenType === NodeChildrenType.FancyText
          ) {
            if (graphemeRangeInclusive) {
              text.push(
                ...(nodeChain.tipNode.children.slice(graphemeRangeInclusive[0], graphemeRangeInclusive[1] + 1) as Text)
              );
            }
          }
        }
      );

      const newNode = payload.template.instantiate(text);
      services.execute(deleteImplementation({ target: { interactorId: target.interactor.id } }));
      services.execute(insert({ target: { interactorId: target.interactor.id }, node: newNode }));
    }
  }
});
