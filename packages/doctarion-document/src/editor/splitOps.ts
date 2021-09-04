import lodash from "lodash";

import { Chain } from "../basic-traversal";
import { CursorOrientation } from "../cursor";
import { Block, NodeUtils, ObjectNode } from "../document-model";
import { FlowDirection } from "../working-document";

import { delete_ } from "./deletionOps";
import { createCoreOperation } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { TargetPayload } from "./payloads";
import { isNavigatorAtEdgeOfBlock, selectTargets } from "./utils";

export const splitBlock = createCoreOperation<TargetPayload>("splitBlock", (state, services, payload) => {
  const targets = selectTargets(state, services, payload.target, true);

  const anchorsToSplit = [];
  for (const target of lodash.reverse(targets)) {
    if (target.isSelection) {
      if (target.isMainCursorFirst) {
        anchorsToSplit.push({ anchorId: target.interactor.mainAnchor, navigator: target.navigators[0] });
        anchorsToSplit.push({ anchorId: target.interactor.selectionAnchor, navigator: target.navigators[1] });
      } else {
        anchorsToSplit.push({ anchorId: target.interactor.selectionAnchor, navigator: target.navigators[0] });
        anchorsToSplit.push({ anchorId: target.interactor.mainAnchor, navigator: target.navigators[1] });
      }
    } else {
      anchorsToSplit.push({ anchorId: target.interactor.mainAnchor, navigator: target.navigator });
    }
  }

  // Is it ok that for selections this isn't properly ordered?
  for (const { anchorId, navigator } of lodash.reverse(anchorsToSplit)) {
    // const direction = FlowDirection.Forward; // payload.direction || FlowDirection.Backward;
    // const isForward = direction === FlowDirection.Forward;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = navigator.chain.searchBackwardsAndSplit(
      // eslint-disable-next-line @typescript-eslint/unbound-method
      NodeUtils.isBlockContainer
    )!;

    const blockContainerSubChain = result[0];
    const toEdgeSubChain = result[1];

    const blockContainerNode = blockContainerSubChain[blockContainerSubChain?.length - 1]?.node;
    const blockNode = toEdgeSubChain[0]?.node;
    let blockIndex = toEdgeSubChain[0]?.pathPart?.index;

    if (!blockContainerNode || !blockNode) {
      // Can't split the document
      continue;
    }

    if (!NodeUtils.isBlockContainer(blockContainerNode) || blockIndex === undefined) {
      throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState);
    }

    const atLeadingEdge = isNavigatorAtEdgeOfBlock(navigator, FlowDirection.Backward);
    const atTrailingEdge = !atLeadingEdge && isNavigatorAtEdgeOfBlock(navigator, FlowDirection.Forward);
    if (atLeadingEdge || atTrailingEdge) {
      state.insertBlock(
        blockContainerNode,
        blockIndex + (atTrailingEdge ? 1 : 0),
        NodeUtils.cloneWithoutContents(blockNode as ObjectNode) as Block
      );
      blockIndex++;

      if (!atLeadingEdge) {
        navigator.navigateToNextCursorPosition();
      }
    } else {
      const splitChildIndices = toEdgeSubChain.slice(1).map((x) => x.pathPart.index);
      if (
        navigator.cursor.orientation === CursorOrientation.After
        // || navigator.cursor.orientation === CursorOrientation.On // && direction === FlowDirection.Forward)
      ) {
        splitChildIndices[splitChildIndices.length - 1]++;
      }

      if (
        navigator.cursor.orientation === CursorOrientation.Before ||
        navigator.cursor.orientation === CursorOrientation.After
      ) {
        // Make sure we have padded the last node (if we are before or after an insertion point)
        if (NodeUtils.hasSomeChildren(navigator.tip.node)) {
          splitChildIndices.push(
            navigator.cursor.orientation === CursorOrientation.Before
              ? 0
              : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                NodeUtils.getChildren(navigator.tip.node)!.length - 1
          );
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      state.splitNode(state.getId(blockNode)!, splitChildIndices);

      navigator.navigateFreeformTo(new Chain(...blockContainerSubChain).path);
      navigator.navigateFreeformToChild(blockIndex + 1);
      navigator.navigateToFirstDescendantCursorPosition();
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    state.updateAnchor(anchorId!, services.interactors.cursorNavigatorToAnchorPosition(navigator));
  }
});
