import lodash from "lodash";

import { CursorOrientation } from "../cursor";
import { Block, NodeUtils, ObjectNode } from "../document-model";
import { FlowDirection } from "../working-document";

import { delete_ } from "./deletionOps";
import { createCoreOperation } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { TargetPayload } from "./payloads";
import { isNavigatorAtEdgeOfBlock, selectTargets } from "./utils";

export const splitBlock = createCoreOperation<TargetPayload>("splitBlock", (state, services, payload) => {
  let targets = selectTargets(state, services, payload.target, true);

  // Delete selection first
  let anySelections = false;
  for (const target of lodash.reverse(targets)) {
    if (target.isSelection) {
      anySelections = true;
      // Delete a selection (this will turn it into a non-selection)
      services.execute(
        state,
        delete_({
          target: { interactorId: target.interactor.id },
        })
      );
    }
  }

  targets = anySelections ? selectTargets(state, services, payload.target, true) : targets;

  for (const target of lodash.reverse(targets)) {
    if (target.isSelection) {
      throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState);
    }

    // const direction = FlowDirection.Forward; // payload.direction || FlowDirection.Backward;
    // const isForward = direction === FlowDirection.Forward;

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const blockContainerSubChain = target.navigator.chain.searchBackwardsForSubChain(NodeUtils.isBlockContainer);

    const blockContainerNode = blockContainerSubChain?.[0]?.node;
    const blockNode = blockContainerSubChain?.[1]?.node;
    let blockIndex = blockContainerSubChain?.[1]?.pathPart.index;

    if (
      blockContainerNode === undefined ||
      !NodeUtils.isBlockContainer(blockContainerNode) ||
      blockIndex === undefined ||
      blockNode === undefined
    ) {
      throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState);
    }

    const atEdge = isNavigatorAtEdgeOfBlock(target.navigator, FlowDirection.Forward);
    if (atEdge) {
      state.insertBlock(
        blockContainerNode,
        blockIndex,
        NodeUtils.cloneWithoutContents(blockNode as ObjectNode) as Block
      );
      blockIndex++;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const splitChildIndices = blockContainerSubChain!.slice(2).map((x) => x.pathPart.index);
      if (
        target.navigator.cursor.orientation === CursorOrientation.After ||
        target.navigator.cursor.orientation === CursorOrientation.On // && direction === FlowDirection.Forward)
      ) {
        splitChildIndices[splitChildIndices.length - 1]++;
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      state.splitNode(state.getId(blockNode)!, splitChildIndices);
    }
  }
});
