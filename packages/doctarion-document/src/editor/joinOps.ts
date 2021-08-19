/* eslint-disable @typescript-eslint/unbound-method */
import * as immer from "immer";
import { Draft } from "immer";
import lodash from "lodash";

import { LiftingPathMap, NodeNavigator, Path, PathString, Range } from "../basic-traversal";
import { CursorOrientation } from "../cursor";
import { Block, InlineText, Node, NodeUtils } from "../models";
import { NodeId } from "../working-document";

import { deletePrimitive } from "./deletionOps";
import { Interactor, InteractorAnchorType } from "./interactor";
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
    const destinationNav = getNavigatorToSiblingIfMatchingPredicate(sourceNav, direction, NodeUtils.isBlock);
    if (!destinationNav) {
      continue;
    }
    const sourceBlock = sourceNav.tip.node as Block;
    const destinationBlock = destinationNav.tip.node as Block;
    const destinationBlockOriginalChildCount = destinationBlock.children.length;
    const sourceBlockOriginalChildCount = (sourceNav.tip.node as Block).children.length;

    moveBlockChildren(sourceNav, destinationNav, services, direction);

    adjustAnchorPositionsAfterBlockMerge(
      state,
      services,
      direction,
      sourceBlock,
      sourceBlockOriginalChildCount,
      destinationBlock,
      destinationBlockOriginalChildCount
    );

    services.execute(state, deletePrimitive({ path: sourceNav.path, direction }));

    // This updates interactors so they are on their preferred cursor position
    // The true means we will update all interactor anchors... we don't strictly
    // need to do this but its easier to code than figuring out the boundary
    // cases (interactors on the first/last child of the joined blocks).
    services.interactors.jiggleInteractors(services, true);

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

  // TODO can make this better?
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

    adjustAnchorPositionsAfterInlineTextMerge(
      state,
      services,
      payload.direction,
      sourceInlineText,
      sourceInlineTextOriginalChildCount,
      destinationInlineText,
      destinationInlineTextOriginalChildCount
    );

    services.execute(state, deletePrimitive({ path: sourceNav.path, direction: payload.direction }));

    // This could be redundant with what deletePrimitive is doing...
    services.interactors.jiggleInteractors(services);
  }
);

function adjustAnchorPositionsAfterBlockMerge(
  state: Draft<EditorState>,
  services: EditorOperationServices,
  direction: FlowDirection,
  source: Block,
  sourceOriginalChildCount: number,
  destination: Block,
  destinationOriginalChildCount: number
) {
  const destinationId = NodeId.getId(destination);
  const sourceId = NodeId.getId(source);

  if (!destinationId || !sourceId) {
    return;
  }

  function caseForwardDestination(interactor: Interactor, anchorType: InteractorAnchorType) {
    const a = castDraft(interactor.getAnchor(anchorType));
    if (a && a.nodeId === destinationId && destinationOriginalChildCount === 0 && sourceOriginalChildCount > 0) {
      a.orientation = CursorOrientation.After;
      // This will get fixed by the jiggling
      services.interactors.notifyUpdated(interactor.id);
    }
  }

  if (direction === FlowDirection.Backward) {
    // Nothing to do
  } else {
    for (const i of Object.values(state.interactors)) {
      caseForwardDestination(i, InteractorAnchorType.Main);
      i.selectionAnchor && caseForwardDestination(i, InteractorAnchorType.SelectionAnchor);
    }
  }
}

function adjustAnchorPositionsAfterInlineTextMerge(
  state: Draft<EditorState>,
  services: EditorOperationServices,
  direction: FlowDirection,
  source: InlineText,
  sourceOriginalChildCount: number,
  destination: InlineText,
  destinationOriginalChildCount: number
) {
  const destinationId = NodeId.getId(destination);
  const sourceId = NodeId.getId(source);

  if (!destinationId || !sourceId) {
    return;
  }

  function caseBackwardsDestination(interactor: Interactor, anchorType: InteractorAnchorType) {
    const a = castDraft(interactor.getAnchor(anchorType));
    if (a && a.nodeId === destinationId && destinationOriginalChildCount === 0 && sourceOriginalChildCount > 0) {
      a.graphemeIndex = 0;
      a.orientation = CursorOrientation.Before;
      services.interactors.notifyUpdated(interactor.id);
    }
  }

  function caseForwardDestination(interactor: Interactor, anchorType: InteractorAnchorType) {
    const a = castDraft(interactor.getAnchor(anchorType));
    if (a && a.nodeId === destinationId) {
      if (a.graphemeIndex !== undefined) {
        a.graphemeIndex = sourceOriginalChildCount + a.graphemeIndex;
      }
      services.interactors.notifyUpdated(interactor.id);
    }
  }

  function caseBackwardSource(interactor: Interactor, anchorType: InteractorAnchorType) {
    const a = castDraft(interactor.getAnchor(anchorType));
    if (a && a.nodeId === sourceId) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      a.nodeId = destinationId!;
      if (a.graphemeIndex !== undefined) {
        a.graphemeIndex = destinationOriginalChildCount + a.graphemeIndex;
      } else if (destinationOriginalChildCount > 0) {
        a.graphemeIndex = destinationOriginalChildCount - 1;
        // TODO technically ... orientation may have a different preference but then again that could change after re-layout...
        a.orientation = CursorOrientation.After;
      }
      services.interactors.notifyUpdated(interactor.id);
    }
  }

  function caseForwardSource(interactor: Interactor, anchorType: InteractorAnchorType) {
    const a = castDraft(interactor.getAnchor(anchorType));
    if (a && a.nodeId === sourceId) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      a.nodeId = destinationId!;
      services.interactors.notifyUpdated(interactor.id);

      if (a.graphemeIndex === undefined && destinationOriginalChildCount > 0) {
        a.graphemeIndex = 0; // destinationOriginalChildCount - 1;
        a.orientation = CursorOrientation.Before;
      }
    }
  }

  if (direction === FlowDirection.Backward) {
    for (const i of Object.values(state.interactors)) {
      caseBackwardsDestination(i, InteractorAnchorType.Main);
      i.selectionAnchor && caseBackwardsDestination(i, InteractorAnchorType.SelectionAnchor);
      caseBackwardSource(i, InteractorAnchorType.Main);
      i.selectionAnchor && caseBackwardSource(i, InteractorAnchorType.SelectionAnchor);
    }
  } else {
    for (const i of Object.values(state.interactors)) {
      caseForwardDestination(i, InteractorAnchorType.Main);
      i.selectionAnchor && caseForwardDestination(i, InteractorAnchorType.SelectionAnchor);
      caseForwardSource(i, InteractorAnchorType.Main);
      i.selectionAnchor && caseForwardSource(i, InteractorAnchorType.SelectionAnchor);
    }
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
