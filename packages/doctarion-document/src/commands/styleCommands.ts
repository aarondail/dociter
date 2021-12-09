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

export const style = coreCommand<StylePayload>("style", (state, services, payload) => {
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
            const [{ name }, strip] = textStyleStripFacet;
            // TODO this is not finished
            // state.setNodeTextStyle(inlineNodeChain.tipNode, payload.style, graphemeRangeInclusive);
          }
        }
      }
    );
  }
});

export const clearStyles = coreCommand<TargetPayload>("clearStyles", (state, services, payload) => {
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
            const [{ name }, strip] = textStyleStripFacet;
            // TODO this is not finished
            // state.clearNodeTextStyle(inlineNodeChain.tipNode, graphemeRangeInclusive);
          }
        }
      }
    );
  }
});
