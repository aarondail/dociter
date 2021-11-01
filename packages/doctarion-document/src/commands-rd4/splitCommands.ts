import { Node, NodeChildrenType } from "../document-model-rd5";
import { Chain, CursorOrientation, PseudoNode } from "../traversal-rd4";
import { ReadonlyWorkingNode } from "../working-document-rd4";

import { CommandError } from "./error";
import { TargetPayload } from "./payloads";
import { coreCommand } from "./types";
import { CommandUtils } from "./utils";

export enum SplitType {
  Blocks = "BLOCKS",
}
interface SplitOptions {
  readonly type: SplitType;
}

export type SplitPayload = TargetPayload & Partial<SplitOptions>;

export const split = coreCommand<SplitPayload>("split", (state, services, payload) => {
  const targets = CommandUtils.selectTargets(state, payload.target);
  targets.reverse();

  const anchorsToSplit = [];
  for (const target of targets) {
    if (target.selectionAnchorNavigator) {
      if (target.isMainCursorFirst) {
        anchorsToSplit.push({ anchorId: target.interactor.mainAnchor, navigator: target.mainAnchorNavigator });
        anchorsToSplit.push({
          anchorId: target.interactor.selectionAnchor,
          navigator: target.selectionAnchorNavigator,
        });
      } else {
        anchorsToSplit.push({
          anchorId: target.interactor.selectionAnchor,
          navigator: target.selectionAnchorNavigator,
        });
        anchorsToSplit.push({ anchorId: target.interactor.mainAnchor, navigator: target.mainAnchorNavigator });
      }
    } else {
      anchorsToSplit.push({ anchorId: target.interactor.mainAnchor, navigator: target.mainAnchorNavigator });
    }
  }

  // Is it ok that for selections this isn't properly ordered?
  anchorsToSplit.reverse();
  for (const { anchorId, navigator } of anchorsToSplit) {
    // const direction = FlowDirection.Forward; // payload.direction || FlowDirection.Backward;
    // const isForward = direction === FlowDirection.Forward;

    const result = navigator.chain.searchBackwardsAndSplit(
      (n) =>
        PseudoNode.isNode(n) &&
        (n.nodeType.childrenType === NodeChildrenType.Blocks ||
          n.nodeType.childrenType === NodeChildrenType.BlocksAndSuperBlocks)
      // NodeUtils.isBlockContainer
    )!;

    const blockContainerSubChain = result[0];
    const toEdgeSubChain = result[1];

    const blockContainerNode = blockContainerSubChain[blockContainerSubChain?.length - 1]?.node as ReadonlyWorkingNode;
    const blockNode = toEdgeSubChain[0]?.node as ReadonlyWorkingNode;
    const blockIndex = toEdgeSubChain[0]?.pathPart?.index;

    if (!blockContainerNode || !blockNode) {
      // Can't split the document
      continue;
    }

    if (!CommandUtils.doesNodeTypeHaveBlockChildren(blockContainerNode) || blockIndex === undefined) {
      throw new CommandError("Block container not found ");
    }

    const splitChildIndices = toEdgeSubChain.slice(1).map((x) => x.pathPart!.index);
    if (
      navigator.cursor.orientation === CursorOrientation.After
      // || navigator.cursor.orientation === CursorOrientation.On // && direction === FlowDirection.Forward)
    ) {
      splitChildIndices[splitChildIndices.length - 1]!++;
    }

    if (
      navigator.cursor.orientation === CursorOrientation.Before ||
      navigator.cursor.orientation === CursorOrientation.After
    ) {
      // Make sure we have padded the last node (if we are before or after an insertion point)
      if (navigator.tip.node instanceof Node && !(navigator.tip.node.nodeType.childrenType === NodeChildrenType.None)) {
        splitChildIndices.push(
          navigator.cursor.orientation === CursorOrientation.Before ? 0 : navigator.tip.node.children.length - 1
        );
      }
      // }

      state.splitNode(blockNode, splitChildIndices as number[]);

      navigator.navigateFreelyTo(new Chain(...blockContainerSubChain).path);
      navigator.navigateFreelyToChild(blockIndex + 1);
      navigator.navigateToFirstDescendantCursorPosition();
    }

    state.updateAnchor(anchorId!, state.getAnchorParametersFromCursorNavigator(navigator));
  }
});
