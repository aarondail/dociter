/* eslint-disable @typescript-eslint/unbound-method */
import lodash from "lodash";

import { LiftingPathMap, NodeNavigator, Range } from "../basic-traversal";
import { InlineText, NodeUtils } from "../document-model";
import { FlowDirection } from "../working-document";

import { createCoreOperation } from "./operation";
import { TargetPayload } from "./payloads";
import { navigateToAncestorMatchingPredicate, selectTargets } from "./utils";

interface JoinBlocksOptions {
  /**
   * Note for selections this doesn't affect which blocks will be joined, but it
   * does affect whether the children are joined into the first selected block,
   * or the last.
   */
  readonly direction: FlowDirection;
}

export type JoinBlocksPayload = TargetPayload & Partial<JoinBlocksOptions>;

export const joinBlocks = createCoreOperation<JoinBlocksPayload>("join/blocks", (state, services, payload) => {
  const direction = payload.direction ?? FlowDirection.Backward;

  const targets = selectTargets(state, services, payload.target);

  // Not really sure we need to do this... vs. just iterating through the
  // targets and processing them immediately
  const toJoin = new LiftingPathMap<{ readonly block: NodeNavigator }>();

  for (const target of targets) {
    // Skip any interactor (or throw error) if the interactor is a selection (for now)
    if (target.isSelection) {
      const { navigators } = target;
      const startBlock = navigateToAncestorMatchingPredicate(navigators[0].toNodeNavigator(), NodeUtils.isBlock);
      const endBlock = navigateToAncestorMatchingPredicate(navigators[1].toNodeNavigator(), NodeUtils.isBlock);
      if (!startBlock || !endBlock) {
        break;
      }

      new Range(startBlock.path, endBlock.path).walk(
        state.document,
        (n) => {
          // Skip the start block if we are going backwards, or the end block if
          // we are going forwards
          if (direction === FlowDirection.Backward && n.path.equalTo(startBlock.path)) {
            // Skip
          } else if (direction === FlowDirection.Forward && n.path.equalTo(endBlock.path)) {
            // Skip
          } else {
            toJoin.add(n.path, { block: n.clone() });
          }
        },
        NodeUtils.isBlock,
        NodeUtils.isBlock
      );
    } else {
      const { navigator } = target;
      const block = navigateToAncestorMatchingPredicate(navigator.toNodeNavigator(), NodeUtils.isBlock);
      if (block) {
        toJoin.add(block.path, { block });
      }
    }
  }

  for (const { elements } of lodash.reverse(toJoin.getAllOrderedByPaths())) {
    const sourceNav = elements[0].block;
    const destinationNode =
      direction === FlowDirection.Backward ? sourceNav.precedingSiblingNode : sourceNav.nextSiblingNode;
    if (!destinationNode || !NodeUtils.isBlock(destinationNode)) {
      continue;
    }

    state.joinBlocksAtPath(sourceNav.path, payload.direction || FlowDirection.Backward);
  }
});

interface JoinInlineTextOptions {
  /**
   * Note for selections this doesn't affect which inline texts will be joined,
   * but it does affect whether the children are joined into the first selected
   * inline text, or the last.
   */
  readonly direction: FlowDirection;
}

export type JoinInlineTextPayload = TargetPayload & Partial<JoinInlineTextOptions>;

export const joinInlineText = createCoreOperation<JoinBlocksPayload>("join/inlineText", (state, services, payload) => {
  const direction = payload.direction ?? FlowDirection.Backward;

  const targets = selectTargets(state, services, payload.target);

  const toJoin = new LiftingPathMap<{ readonly inlineText: NodeNavigator }>();

  for (const target of targets) {
    // Skip any interactor (or throw error) if the interactor is a selection (for now)
    if (target.isSelection) {
      const { navigators } = target;
      const startInlineTextNav = navigateToAncestorMatchingPredicate(
        navigators[target.isMainCursorFirst ? 0 : 1].toNodeNavigator(),
        NodeUtils.isInlineText
      );
      const endInlineTextNav = navigateToAncestorMatchingPredicate(
        navigators[target.isMainCursorFirst ? 1 : 0].toNodeNavigator(),
        NodeUtils.isInlineText
      );
      if (!startInlineTextNav || !endInlineTextNav) {
        break;
      }

      new Range(startInlineTextNav.path, endInlineTextNav.path).walk(
        state.document,
        (n) => {
          // Skip the start block if we are going backwards, or the end block if
          // we are going forwards
          if (direction === FlowDirection.Backward && n.path.equalTo(startInlineTextNav.path)) {
            // Skip
          } else if (direction === FlowDirection.Forward && n.path.equalTo(endInlineTextNav.path)) {
            // Skip
          } else {
            toJoin.add(n.path, { inlineText: n.clone() });
          }
        },
        NodeUtils.isInlineText,
        NodeUtils.isInlineText
      );
    } else {
      const { navigator } = target;
      const inlineTextNav = navigateToAncestorMatchingPredicate(navigator.toNodeNavigator(), NodeUtils.isInlineText);
      if (inlineTextNav) {
        toJoin.add(inlineTextNav.path, { inlineText: inlineTextNav });
      }
    }
  }

  for (const { elements } of lodash.reverse(toJoin.getAllOrderedByPaths())) {
    const nav = elements[0].inlineText;
    if (
      !((direction === FlowDirection.Backward ? nav.precedingSiblingNode : nav.nextSiblingNode) instanceof InlineText)
    ) {
      continue;
    }
    state.joinInlineTextAtPath(nav.path, direction);
  }
});
