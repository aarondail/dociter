import { TextStyleModifier } from "../text-model";
import { PseudoNode } from "../traversal";

import { TargetPayload } from "./payloads";
import { coreCommand } from "./types";
import { CommandUtils, SelectTargetsSort } from "./utils";

interface StyleOptions {
  /**
   * Use `null` for the properties here to clear individual styles.
   */
  readonly style: TextStyleModifier;
}

export type StylePayload = TargetPayload & StyleOptions;

export const styleText = coreCommand<StylePayload>("styleText", (state, services, payload) => {
  const targets = CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Forward);
  for (const target of targets) {
    if (!target.selectionRange) {
      continue;
    }
    CommandUtils.walkInlineGraphemeRangesInSelectionTarget(
      state,
      target,
      (inlineNodeChain, facet, graphemeRangeInclusive) => {
        if (!facet && PseudoNode.isNode(inlineNodeChain.tipNode) && graphemeRangeInclusive) {
          const textStyleStripFacet = inlineNodeChain.tipNode.getTextStyleStripFacet();
          if (textStyleStripFacet) {
            state.applyTextStyle(
              inlineNodeChain.tipNode,
              payload.style,
              graphemeRangeInclusive[0],
              graphemeRangeInclusive[1]
            );
          }
        }
      }
    );
  }
});

export const clearTextStyle = coreCommand<TargetPayload>("clearTextStyle", (state, services, payload) => {
  const targets = CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Forward);
  for (const target of targets) {
    if (!target.selectionRange) {
      continue;
    }
    CommandUtils.walkInlineGraphemeRangesInSelectionTarget(
      state,
      target,
      (inlineNodeChain, facet, graphemeRangeInclusive) => {
        if (PseudoNode.isNode(inlineNodeChain.tipNode) && graphemeRangeInclusive) {
          const textStyleStripFacet = inlineNodeChain.tipNode.getTextStyleStripFacet();
          if (textStyleStripFacet) {
            state.clearTextStyle(inlineNodeChain.tipNode, graphemeRangeInclusive[0], graphemeRangeInclusive[1]);
          }
        }
      }
    );
  }
});
