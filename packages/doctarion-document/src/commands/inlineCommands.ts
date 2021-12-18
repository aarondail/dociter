import { NodeCategory, NodeChildrenType } from "../document-model";
import { FancyGrapheme, Text } from "../text-model";
import { PseudoNode } from "../traversal";
import { NodeTemplate, ReadonlyWorkingNode } from "../working-document";

import { deleteImplementation } from "./deletionCommands";
import { CommandError } from "./error";
import { insert } from "./insertionCommands";
import { TargetPayload } from "./payloads";
import { coreCommand } from "./types";
import { CommandUtils, SelectTargetsSort } from "./utils";

export interface ReconstructInlinesOptions {
  readonly template: NodeTemplate;
}

export type ReconstructInlinesPayload = TargetPayload & ReconstructInlinesOptions;

export const reconstructInlines = coreCommand<ReconstructInlinesPayload>(
  "reconstructInlines",
  (state, services, payload) => {
    const targets = CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Reversed);

    if (payload.template.nodeType.category !== NodeCategory.Inline) {
      throw new CommandError("Cannot reconstruct to a non-inline node type (currently)");
    } else if (payload.template.nodeType.childrenType !== NodeChildrenType.FancyText) {
      // Maybe implement this behavior rather than error out?
      throw new CommandError("Cannot reconstruct inlines to a node type that does not have fancy text as children");
    }

    for (const target of targets) {
      if (target.selectionAnchorNavigator) {
        // Change all contained inlines
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
                  ...(nodeChain.tipNode.children.slice(
                    graphemeRangeInclusive[0],
                    graphemeRangeInclusive[1] + 1
                  ) as Text)
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
  }
);

export interface ChangeInlineTypeOptions {
  readonly template: NodeTemplate;
}

export type ChangeInlineTypePayload = TargetPayload & ChangeInlineTypeOptions;

export const changeInlineType = coreCommand<ChangeInlineTypePayload>("changeInlineType", (state, services, payload) => {
  const targets = CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Reversed);

  if (
    payload.template.nodeType.category !== NodeCategory.Inline ||
    payload.template.nodeType.childrenType !== NodeChildrenType.FancyText
  ) {
    throw new CommandError(
      "Cannot change inlines to a non-inline node type, or a node type that does not have fancy text as children."
    );
  }

  const inlines = new Set<ReadonlyWorkingNode>();
  for (const target of targets) {
    if (target.selectionAnchorNavigator) {
      CommandUtils.walkInlinesInSelectionTarget(
        state,
        target,
        (n) =>
          (n.tip.node as ReadonlyWorkingNode).nodeType.childrenType === NodeChildrenType.FancyText &&
          inlines.add(n.tip.node as ReadonlyWorkingNode)
      );
    } else {
      // Change the whole node being pointed to
      const n = CommandUtils.findAncestorInlineNodeWithNavigator(target.mainAnchorNavigator);
      const node = n?.node;
      if (
        node &&
        node.nodeType.category === NodeCategory.Inline &&
        node.nodeType.childrenType === NodeChildrenType.FancyText
      ) {
        inlines.add(node);
      }
    }
  }

  for (const inline of inlines.values()) {
    state.changeNodeTypeAndFacets(inline, payload.template);
  }
});
