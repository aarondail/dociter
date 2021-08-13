/* eslint-disable @typescript-eslint/unbound-method */
import * as immer from "immer";
import { Draft } from "immer";
import lodash from "lodash";

import { LiftingPathMap, NodeNavigator, Path, PathString, Range } from "../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation } from "../cursor";
import { Block, InlineText, Node, NodeUtils } from "../models";
import { InteractorOrderingEntry } from "../working-document";

import { deletePrimitive } from "./deletionOps";
import { createCoreOperation } from "./operation";
import { TargetPayload } from "./payloads";
import { EditorOperationServices } from "./services";
import { EditorState } from "./state";
import {
  FlowDirection,
  getNavigatorToSiblingIfMatchingPredicate,
  navigateToAncestorMatchingPredicate,
  selectTargets,
} from "./utils";

const castDraft = immer.castDraft;

interface JoinBlocksOptions {
  /**
   * Note for selections this doesn't affect which blocks will be joined, but it
   * does affect whether the children are joined into the first selected block,
   * or the last.
   */
  readonly direction: FlowDirection;

  readonly mergeCompatibleInlineTextsIfPossible: boolean;
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
    const destinationNav = getNavigatorToSiblingIfMatchingPredicate(sourceNav, direction, NodeUtils.isBlock);
    if (!destinationNav) {
      continue;
    }
    const destinationBlock = destinationNav.tip.node as Block;
    const destinationBlockOriginalChildCount = destinationBlock.children.length;
    const sourceBlockOriginalChildCount = (sourceNav.tip.node as Block).children.length;

    moveBlockChildren(sourceNav, destinationNav, services, direction);

    adjustInteractorPositionsAfterMoveChildren(
      state,
      services,
      sourceNav,
      destinationNav,
      sourceBlockOriginalChildCount,
      destinationBlockOriginalChildCount,
      direction
    );

    services.execute(state, deletePrimitive({ path: sourceNav.path }));

    if (payload.mergeCompatibleInlineTextsIfPossible) {
      mergeCompatibleInlineChildrenIfPossible(
        direction === FlowDirection.Backward ? destinationNav.path : sourceNav.path,
        destinationBlock,
        direction === FlowDirection.Backward
          ? destinationBlockOriginalChildCount - 1
          : sourceBlockOriginalChildCount - 1,
        state,
        services
      );
    }
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
        navigators[0].toNodeNavigator(),
        NodeUtils.isInlineText
      );
      const endInlineTextNav = navigateToAncestorMatchingPredicate(
        navigators[1].toNodeNavigator(),
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
    services.execute(state, joinInlineTextPrimitive({ path: elements[0].inlineText.path, direction }));
  }
});

export const joinInlineTextPrimitive = createCoreOperation<{ path: Path | PathString; direction: FlowDirection }>(
  "join/inlineText/primitive",
  (state, services, payload) => {
    const sourceNav = new NodeNavigator(state.document);

    if (!sourceNav.navigateTo(payload.path) || !(sourceNav.tip.node instanceof InlineText)) {
      return;
    }

    const destinationNav = getNavigatorToSiblingIfMatchingPredicate(
      sourceNav,
      payload.direction,
      NodeUtils.isInlineText
    );
    if (!destinationNav) {
      return;
    }
    const destinationInlineText = destinationNav.tip.node as InlineText;
    const sourceInlineText = sourceNav.tip.node;
    const destinationInlineTextOriginalChildCount = destinationInlineText.children.length;
    const sourceInlineTextOriginalChildCount = sourceInlineText.children.length;

    moveInlineTextChildren(sourceNav, destinationNav, payload.direction);

    // Adjust modifiers in edge case of an empty inline text
    if (destinationInlineTextOriginalChildCount === 0) {
      castDraft(destinationInlineText).modifiers = sourceInlineText.modifiers;
    }

    adjustInteractorPositionsAfterMoveChildren(
      state,
      services,
      sourceNav,
      destinationNav,
      sourceInlineTextOriginalChildCount,
      destinationInlineTextOriginalChildCount,
      payload.direction
    );

    services.execute(state, deletePrimitive({ path: sourceNav.path }));

    return;
  }
);

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
      n.navigateToUnchecked(cursor);
      n.navigateToFirstDescendantCursorPosition();
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
          destinationNode.path, // Note, see comment above
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
        // This is a bit of a hack, but seems necessary since inline text cursor
        // behavior is different and we end up with a BEFORE orientation which
        // is wrong ONCE the source node is deleted
        if (sourceNode.tip.node instanceof InlineText && sourceBlockOriginalChildCount === 0) {
          n.navigateToPrecedingCursorPosition();
        }
        cursor = castDraft(n.cursor);
      }
      // } else if (!isBack && cursor.orientation === CursorOrientation.On) {
      //   const n = new CursorNavigator(state.document, services.layout);
      //   n.navigateTo(cursor);
      //   n.navigateToNextCursorPosition();
      //   n.navigateToPrecedingCursorPosition();
      //   cursor = castDraft(n.cursor);
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
        const n = new CursorNavigator(state.document, services.layout);
        n.navigateTo(cursor);
        if (n.navigateToNextCursorPosition()) {
          n.navigateToPrecedingCursorPosition();
        }
        cursor = n.cursor;
      } else {
        continue;
      }
    }

    InteractorOrderingEntry.setCursor(interactor, cursorType, cursor);
    services.interactors.notifyUpdated(interactor.id);
  }
}

function moveBlockChildren(
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

function moveInlineTextChildren(
  sourceNav: NodeNavigator,
  destinationNav: NodeNavigator,
  direction: FlowDirection
): void {
  const source = sourceNav.tip.node as InlineText;
  const dest = destinationNav.tip.node as InlineText;

  if (direction === FlowDirection.Backward) {
    castDraft(dest).children = [...dest.children, ...source.children];
  } else {
    castDraft(dest).children = [...source.children, ...dest.children];
  }
  castDraft(source).children = [];
}

function mergeCompatibleInlineChildrenIfPossible(
  path: Path,
  block: Node,
  leftChildIndex: number,
  state: Draft<EditorState>,
  services: EditorOperationServices
): void {
  if (!NodeUtils.isInlineContainer(block)) {
    return;
  }
  if (leftChildIndex >= 0 && leftChildIndex >= block.children.length - 1) {
    return;
  }
  const leftChild = block.children[leftChildIndex];
  const rightChild = block.children[leftChildIndex + 1];

  if (!(leftChild instanceof InlineText && rightChild instanceof InlineText)) {
    return;
  }

  if (
    !(
      leftChild.children.length === 0 ||
      rightChild.children.length === 0 ||
      lodash.isEqual(leftChild.modifiers, rightChild.modifiers)
    )
  ) {
    return;
  }

  const inlineTextNav = new NodeNavigator(state.document);
  inlineTextNav.navigateTo(path);
  if (leftChild.children.length === 0 && rightChild.children.length > 0) {
    inlineTextNav.navigateToChild(leftChildIndex + 1);
    services.execute(state, joinInlineTextPrimitive({ path: inlineTextNav.path, direction: FlowDirection.Backward }));
  } else {
    inlineTextNav.navigateToChild(leftChildIndex);
    services.execute(state, joinInlineTextPrimitive({ path: inlineTextNav.path, direction: FlowDirection.Forward }));
  }
}
