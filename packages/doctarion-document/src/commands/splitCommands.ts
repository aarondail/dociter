import { Node, NodeChildrenType } from "../document-model";
import { Chain, CursorOrientation, PseudoNode } from "../traversal";
import { ReadonlyWorkingNode } from "../working-document";

import { CommandError } from "./error";
import { TargetPayload } from "./payloads";
import { coreCommand } from "./types";
import { CommandUtils, SelectTargetsSort } from "./utils";

export enum SplitType {
  Blocks = "BLOCKS",
}

interface SplitOptions {
  readonly type: SplitType;
}

export type SplitPayload = TargetPayload & Partial<SplitOptions>;

export const split = coreCommand<SplitPayload>("split", (state, services, payload) => {
  const targets = CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Reversed);

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
    const result = navigator.chain.searchBackwardsAndSplit(
      (n) =>
        PseudoNode.isNode(n) &&
        (n.nodeType.childrenType === NodeChildrenType.Blocks ||
          n.nodeType.childrenType === NodeChildrenType.BlocksAndSuperBlocks)
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

    if (!CommandUtils.doesNodeTypeHaveBlockChildren(blockContainerNode.nodeType) || blockIndex === undefined) {
      throw new CommandError("Block container not found ");
    }

    const splitChildIndices = toEdgeSubChain.slice(1).map((x) => x.pathPart!.index);
    if (
      navigator.cursor.orientation === CursorOrientation.After
      // || navigator.cursor.orientation === CursorOrientation.On // && direction === FlowDirection.Forward)
    ) {
      splitChildIndices[splitChildIndices.length - 1]!++;
    }

    let isNavigatorOnGrapheme = false;
    // Make sure we have padded the last node (if we are before or after an insertion point)
    // if (navigator.tip.node instanceof Node && !(navigator.tip.node.nodeType.childrenType === NodeChildrenType.None)) {
    if (PseudoNode.isGrapheme(navigator.tip.node)) {
      isNavigatorOnGrapheme = true;
    }

    if (splitChildIndices.length === 0 && blockNode.children.length === 0) {
      // In this case we just want to insert a new block type... this makes more
      // sense if split means "hit enter" on a paragraph where it sorta doubles
      // as insertion
      state.insertNode(blockContainerNode, new Node(blockNode.nodeType, [], blockNode.facets), blockIndex + 1);
    } else {
      state.splitNode(blockNode, splitChildIndices as number[]);
    }

    navigator.navigateFreelyTo(new Chain(...blockContainerSubChain).path);
    navigator.navigateFreelyToChild(blockIndex + 1);
    navigator.navigateToFirstDescendantCursorPosition();

    // This is to handle the case where we split a non-Span inline (e.g. Hyperlink)
    if (
      isNavigatorOnGrapheme &&
      !PseudoNode.isGrapheme(navigator.tip.node) &&
      (navigator.tip.node as Node).children.length > 0
    ) {
      navigator.navigateToNextCursorPosition();
    }

    state.updateAnchor(anchorId!, state.getAnchorParametersFromCursorNavigator(navigator));
  }
});
