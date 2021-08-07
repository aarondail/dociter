/* eslint-disable @typescript-eslint/unbound-method */
import * as immer from "immer";
import lodash from "lodash";

import { LiftingPathMap, NodeNavigator, Range } from "../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation, ReadonlyCursorNavigator } from "../cursor";
import { Block, InlineText, Node, NodeUtils } from "../models";

import { deletePrimitive } from "./deletionOps";
import { InteractorOrderingEntry } from "./interactor";
import { createCoreOperation } from "./operation";
import { TargetPayload } from "./payloads";
import { EditorOperationServices } from "./services";
import { EditorState } from "./state";
import { FlowDirection, selectTargets } from "./utils";

const castDraft = immer.castDraft;

interface JoinBlocksOptions {
  readonly direction: FlowDirection;
}

export type JoinBlocksPayload = TargetPayload & Partial<JoinBlocksOptions>;

export const joinBlocks = createCoreOperation<JoinBlocksPayload>("join/blocks", (state, services, payload) => {
  const direction = payload.direction ?? FlowDirection.Backward;

  const targets = selectTargets(state, services, payload.target);

  const toJoin = new LiftingPathMap<{ readonly block: NodeNavigator }>();

  for (const target of targets) {
    // Skip any interactor (or throw error) if the interactor is a selection (for now)
    if (target.isSelection) {
      const { navigators } = target;
      const startBlock = findBlock(navigators[0] as ReadonlyCursorNavigator);
      const endBlock = findBlock(navigators[1] as ReadonlyCursorNavigator);
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
        NodeUtils.isBlock
      );
    } else {
      const { navigator } = target;
      const block = findBlock(navigator as ReadonlyCursorNavigator);
      if (block) {
        toJoin.add(block.path, { block });
      }
    }
  }

  for (const { elements } of lodash.reverse(toJoin.getAllOrderedByPaths())) {
    const sourceNav = elements[0].block;
    const destinationNav = findAppropriateSiblingBlock(sourceNav, direction);
    if (!destinationNav) {
      continue;
    }
    const destinationBlock = destinationNav.tip.node as Block;
    const destinationBlockOriginalChildCount = destinationBlock.children.length;
    const sourceBlockOriginalChildCount = (sourceNav.tip.node as Block).children.length;

    moveChildren(sourceNav, destinationNav, services, direction);

    const mergedOneChild = mergeCompatibleInlineChildrenIfPossible(
      destinationBlock,
      direction === FlowDirection.Backward ? destinationBlockOriginalChildCount - 1 : sourceBlockOriginalChildCount - 1,
      services
    );

    adjustInteractorPositionsAfterMoveChildren(
      state,
      services,
      sourceNav,
      destinationNav,
      sourceBlockOriginalChildCount,
      destinationBlockOriginalChildCount - (mergedOneChild ? 1 : 0),
      direction
    );

    services.execute(state, deletePrimitive({ path: sourceNav.path }));
  }
});

function adjustInteractorPositionsAfterMoveChildren(
  state: immer.Draft<EditorState>,
  services: EditorOperationServices,
  sourceNode: NodeNavigator,
  destinationNode: NodeNavigator,
  sourceBlockOriginalChildCount: number,
  destinationBlockOriginalChildCount: number,
  direction: FlowDirection
) {
  const isBack = direction === FlowDirection.Backward;
  // In the forward case only, we have to update interactors of the destination node since the
  // source nodes get inserted in front of them.
  // In the backward we need to update cursors ONLY if they are exactly on their destination node.
  for (const { interactor, cursorType } of isBack
    ? services.interactors.interactorCursorsAt(destinationNode.path)
    : services.interactors.interactorCursorsAtOrDescendantsOf(destinationNode.path)) {
    let cursor = InteractorOrderingEntry.getCursor(interactor, cursorType);

    if (isBack) {
      const n = new CursorNavigator(state.document, services.layout);
      n.navigateTo(cursor);
      n.navigateToNextCursorPosition();
      cursor = castDraft(n.cursor);
    } else {
      if (cursor.orientation === CursorOrientation.On && cursor.path.equalTo(destinationNode.path)) {
        const n = new CursorNavigator(state.document, services.layout);
        n.navigateToUnchecked(cursor);
        n.navigateToLastDescendantCursorPosition();
        cursor = castDraft(n.cursor);
      } else {
        // Technically not a move but I am being lazy here and this works
        const newCursorOrNoChangeReason = cursor.adjustDueToMove(
          destinationNode.path,
          destinationNode.path,
          sourceBlockOriginalChildCount
        );

        if (newCursorOrNoChangeReason instanceof Cursor) {
          cursor = castDraft(newCursorOrNoChangeReason);
        } else {
          continue;
        }
      }
    }
    InteractorOrderingEntry.setCursor(interactor, cursorType, cursor);
    services.interactors.notifyUpdated(interactor.id);
  }

  // Now update interactors inside at or inside the source node
  for (const { interactor, cursorType } of services.interactors.interactorCursorsAtOrDescendantsOf(sourceNode.path)) {
    let cursor = InteractorOrderingEntry.getCursor(interactor, cursorType);

    if (
      cursor.orientation === CursorOrientation.On &&
      (cursor.path.equalTo(destinationNode.path) || cursor.path.equalTo(sourceNode.path))
    ) {
      if (!isBack) {
        const n = new CursorNavigator(state.document, services.layout);
        n.navigateTo(cursor);
        n.navigateToNextCursorPosition();
        cursor = castDraft(n.cursor);
      }
    } else {
      const newCursorOrNoChangeReason = cursor.adjustDueToMove(
        sourceNode.path,
        destinationNode.path,
        // 0 because we in the forward case the source child nodes are inserted into the destination thus
        // it is the destination interactors that need to be updated.
        direction === FlowDirection.Backward ? destinationBlockOriginalChildCount : 0
      );

      if (newCursorOrNoChangeReason instanceof Cursor) {
        cursor = castDraft(newCursorOrNoChangeReason);
      } else {
        continue;
      }
    }

    // Fix up on positions just in case things have changed
    if (cursor.orientation === CursorOrientation.On) {
      const n = new CursorNavigator(state.document, services.layout);
      n.navigateTo(cursor);
      if (n.navigateToNextCursorPosition()) {
        n.navigateToPrecedingCursorPosition();
      }
      cursor = castDraft(n.cursor);
    }

    InteractorOrderingEntry.setCursor(interactor, cursorType, cursor);
    services.interactors.notifyUpdated(interactor.id);
  }
}

function findBlock(navigator: ReadonlyCursorNavigator): NodeNavigator | undefined {
  const navPrime = navigator.toNodeNavigator();
  while (!NodeUtils.isBlock(navPrime.tip.node)) {
    if (!navPrime.navigateToParent()) {
      return undefined;
    }
  }
  return navPrime;
}

function findAppropriateSiblingBlock(navigator: NodeNavigator, direction: FlowDirection): NodeNavigator | undefined {
  const destinationNavigator = navigator.clone();
  if (
    !(direction === FlowDirection.Backward
      ? destinationNavigator.navigateToPrecedingSibling()
      : destinationNavigator.navigateToNextSibling())
  ) {
    return undefined;
  }

  const destinationBlock = destinationNavigator.tip.node;
  if (!NodeUtils.isBlock(destinationBlock)) {
    return undefined;
  }
  return destinationNavigator;
}

function moveChildren(
  sourceBlock: NodeNavigator,
  destinationBlock: NodeNavigator,
  services: EditorOperationServices,
  direction: FlowDirection
): void {
  // This is ok because we only use this in one place where we already know the
  // source and destination navigators point to blocks...
  const source = sourceBlock.tip.node as Block;
  const dest = destinationBlock.tip.node as Block;

  if (direction === FlowDirection.Backward) {
    for (const child of source.children) {
      dest.children.push(child);
      services.tracking.notifyNodeMoved(child, dest);
    }
  } else {
    for (const child of lodash.reverse(source.children)) {
      dest.children.unshift(child);
      services.tracking.notifyNodeMoved(child, dest);
    }
  }
  castDraft(source).children = [];
}

function mergeCompatibleInlineChildrenIfPossible(
  block: Node,
  leftChildIndex: number,
  services: EditorOperationServices
): boolean {
  if (!NodeUtils.isInlineContainer(block)) {
    return false;
  }
  if (leftChildIndex >= 0 && leftChildIndex >= block.children.length - 1) {
    return false;
  }
  const leftChild = block.children[leftChildIndex];
  const rightChild = block.children[leftChildIndex + 1];

  if (!(leftChild instanceof InlineText && rightChild instanceof InlineText)) {
    return false;
  }

  if (
    !(
      leftChild.children.length === 0 ||
      rightChild.children.length === 0 ||
      lodash.isEqual(leftChild.modifiers, rightChild.modifiers)
    )
  ) {
    return false;
  }

  if (leftChild.children.length === 0 && rightChild.children.length > 0) {
    castDraft(leftChild).modifiers = rightChild.modifiers;
  }
  castDraft(leftChild).children = [...leftChild.text, ...rightChild.text];
  services.tracking.unregister(rightChild);
  castDraft(block.children).splice(leftChildIndex + 1, 1);
  return true;
}
