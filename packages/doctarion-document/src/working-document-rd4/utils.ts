/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Document, FacetType, FacetValueType, NodeCategory, NodeChildrenType, NodeType } from "../document-model-rd5";
import { SimpleComparison } from "../miscUtils";
import { Emblem, Emoji, FancyGrapheme, FancyText, Text } from "../text-model-rd4";
import { Chain, CursorNavigator, CursorOrientation, NodeNavigator, Path, PathPart, PseudoNode } from "../traversal-rd4";

import { AnchorParameters, WorkingAnchor, WorkingAnchorRange } from "./anchor";
import { WorkingDocumentError } from "./error";
import { AnchorPullDirection } from "./misc";
import { WorkingDocumentNode, WorkingNode } from "./nodes";

// ----------------------------------------------------------------------------
// These are helper types and functions that are not meant to be exposed to
// other code
// ----------------------------------------------------------------------------

/**
 * Internal meaning not to be exposed outside this folder.
 */
export interface InternalDocumentLocation {
  readonly node: WorkingNode;
  readonly graphemeIndex?: number;
}

/**
 * Internal meaning not to be exposed outside this folder.
 */
export type ContiguousOrderedInternalDocumentLocationArray = readonly InternalDocumentLocation[];

export const Utils = {
  canFacetContainNodesOfType(facet: FacetType, nodeType: NodeType): boolean {
    if (facet.valueType !== FacetValueType.NodeArray) {
      return false;
    }
    if (facet.nodeCategory === undefined) {
      return true;
    }
    return facet.nodeCategory === nodeType.category;
  },
  canNodeBeSplit(node: WorkingNode): boolean {
    if (node.nodeType === Document) {
      return false;
    }
    if (node.nodeType.childrenType === NodeChildrenType.None) {
      return false;
    }
    // Return false if we think this node has no parent or it has one but it
    // isn't part of an array (either a facet NodeArray type or as part of the
    // children).
    if (!node.pathPartFromParent || node.pathPartFromParent.index === undefined) {
      return false;
    }
    return true;
  },
  canNodeTypeContainChildrenOfType(container: NodeType, nodeType: NodeType): boolean {
    switch (container.childrenType) {
      case NodeChildrenType.Inlines:
        return nodeType.category === NodeCategory.Inline;
      case NodeChildrenType.Blocks:
        return nodeType.category === NodeCategory.Block;
      case NodeChildrenType.BlocksAndSuperBlocks:
        return nodeType.category === NodeCategory.Block || nodeType.category === NodeCategory.SuperBlock;
      case NodeChildrenType.Intermediates:
        return (
          nodeType.category === NodeCategory.Intermediate &&
          (container.specificIntermediateChildType === undefined ||
            container.specificIntermediateChildType === nodeType)
        );
    }
    return false;
  },
  doesNodeTypeHaveNodeChildren(type: NodeType): boolean {
    switch (type.childrenType) {
      case NodeChildrenType.FancyText:
      case NodeChildrenType.Text:
      case NodeChildrenType.None:
        return false;
      default:
        return true;
    }
  },
  doesNodeTypeHaveTextOrFancyText(type: NodeType): boolean {
    switch (type.childrenType) {
      case NodeChildrenType.FancyText:
      case NodeChildrenType.Text:
        return true;
      default:
        return false;
    }
  },
  getClosestAdjacentOrParentLocationOutsideOfLocationArray(
    contiguousOrderedLocationArray: ContiguousOrderedInternalDocumentLocationArray,
    document: WorkingDocumentNode,
    direction: AnchorPullDirection
  ): { location: InternalDocumentLocation; type: "sibling" | "parent" } {
    if (contiguousOrderedLocationArray.length === 0) {
      throw new WorkingDocumentError("Did not expect the location array to be empty");
    }
    const isBack = direction === AnchorPullDirection.Backward;
    const location = contiguousOrderedLocationArray[isBack ? 0 : contiguousOrderedLocationArray.length - 1];

    const nav = Utils.getNodeNavigator(document, Utils.getNodePath(location.node));
    if (location.graphemeIndex !== undefined) {
      nav.navigateToChild(location.graphemeIndex);
    }

    // This will not jump to a cursor position in another node
    if (isBack ? nav.navigateToPrecedingSibling() : nav.navigateToNextSibling()) {
      if (location.graphemeIndex !== undefined) {
        const node = nav.parent?.node as WorkingNode;
        return { location: { node, graphemeIndex: nav.tip.pathPart!.index }, type: "sibling" };
      } else {
        const node = nav.tip.node as WorkingNode;
        return { location: { node }, type: "sibling" };
      }
    } else {
      // Note this can be the document
      nav.navigateToParent();
      const node = nav.tip.node as WorkingNode;
      return { location: { node }, type: "parent" };
    }
  },
  getNodeNavigator(document: WorkingDocumentNode, path: Path): NodeNavigator<WorkingNode> {
    const n = new NodeNavigator(document);
    if (!n.navigateTo(path)) {
      throw new WorkingDocumentError("Could not navigate to node.");
    }
    return n;
  },
  getNodePath(node: WorkingNode): Path {
    let tip: WorkingNode | undefined = node;
    const parts = [];
    while (tip && tip.pathPartFromParent) {
      parts.unshift(tip.pathPartFromParent);
      tip = tip.parent;
    }
    return new Path(...parts);
  },
  isAnchorParameters(value: any): value is AnchorParameters {
    return value.node !== undefined && value.orientation !== undefined;
  },
  isAnchorParametersPair(value: any): value is [AnchorParameters, AnchorParameters] {
    if (Array.isArray(value) && value.length === 2) {
      return Utils.isAnchorParameters(value[0]) && Utils.isAnchorParameters(value[1]);
    }
    return false;
  },
  isChainPointingToTheSameNode(left: Chain, right: Chain): boolean {
    if (PseudoNode.isNode(left.tip.node)) {
      return left.tip.node === right.tip.node;
    } else {
      const p = left.parent?.node;
      if (
        p &&
        p === right.parent?.node &&
        left.tip.pathPart &&
        right.tip.pathPart &&
        left.tip.pathPart.compareTo(right.tip.pathPart) === SimpleComparison.Equal
      ) {
        return true;
      }
      return false;
    }
  },
  isFancyGrapheme(value: any): value is FancyGrapheme {
    return typeof value === "string" || value instanceof Emoji || value instanceof Emblem;
  },
  isFancyText(value: any): value is FancyText {
    return Array.isArray(value) && !value.find((x) => !Utils.isFancyGrapheme(x));
  },
  isText(value: any): value is Text {
    return Array.isArray(value) && !value.find((x) => typeof x !== "string");
  },
  navigateCursorNavigatorToFirstCursorPositionOnTheSameNode(nav: CursorNavigator): void {
    const clone = nav.clone();
    const reference = nav.chain;
    if (!nav.navigateToPrecedingCursorPosition()) {
      return;
    }
    if (Utils.isChainPointingToTheSameNode(reference, nav.chain)) {
      if (nav.cursor.orientation === CursorOrientation.On) {
        throw new WorkingDocumentError("We maybe should handle this but we dont right now");
      }
      return;
    }
    if (!nav.navigateToNextCursorPosition() || !Utils.isChainPointingToTheSameNode(reference, nav.chain)) {
      nav.navigateFreelyTo(clone.cursor);
      return;
    }
    return;
  },
  navigateCursorNavigatorToLastCursorPositionOnTheSameNode(nav: CursorNavigator): void {
    const clone = nav.clone();
    const reference = nav.chain;
    if (!nav.navigateToNextCursorPosition()) {
      return;
    }
    if (Utils.isChainPointingToTheSameNode(reference, nav.chain)) {
      if (nav.cursor.orientation === CursorOrientation.On) {
        throw new WorkingDocumentError("We maybe should handle this but we dont right now");
      }
      return;
    }
    if (!nav.navigateToPrecedingCursorPosition() || !Utils.isChainPointingToTheSameNode(reference, nav.chain)) {
      nav.navigateFreelyTo(clone.cursor);
      return;
    }
    return;
  },
  navigateCursorNavigatorToNextCursorPositionOnADifferentNode(nav: CursorNavigator): boolean {
    const chain = nav.chain;
    if (!nav.navigateToNextCursorPosition()) {
      return false;
    }
    if (Utils.isChainPointingToTheSameNode(chain, nav.chain)) {
      if (!nav.navigateToNextCursorPosition()) {
        return false;
      }
      if (Utils.isChainPointingToTheSameNode(chain, nav.chain)) {
        throw new WorkingDocumentError("Navigating twice still didn't result in a new node or the end of the document");
      }
    }
    return true;
  },
  navigateCursorNavigatorToPrecedingCursorPositionOnADifferentNode(nav: CursorNavigator): boolean {
    const chain = nav.chain;
    if (!nav.navigateToPrecedingCursorPosition()) {
      return false;
    }
    if (Utils.isChainPointingToTheSameNode(chain, nav.chain)) {
      if (!nav.navigateToPrecedingCursorPosition()) {
        return false;
      }
      if (Utils.isChainPointingToTheSameNode(chain, nav.chain)) {
        throw new WorkingDocumentError("Navigating twice still didn't result in a new node or the end of the document");
      }
    }
    return true;
  },
  *traverseAllAnchorsOriginatingFrom(node: WorkingNode): Iterable<WorkingAnchor> {
    for (const [, anchorOrRange] of node.getAllFacetAnchors()) {
      if (anchorOrRange instanceof WorkingAnchor) {
        yield anchorOrRange;
      } else if (anchorOrRange instanceof WorkingAnchorRange) {
        yield anchorOrRange.from;
        yield anchorOrRange.to;
      }
    }
  },
  *traverseNodeSubTree(node: WorkingNode): Iterable<WorkingNode> {
    const toVisit: WorkingNode[] = [node];
    while (toVisit.length > 0) {
      const n = toVisit.pop()!;
      yield n;

      const t = n.nodeType;

      // Enqueue (direct) children
      if (Utils.doesNodeTypeHaveNodeChildren(t)) {
        toVisit.push(...(n.children as WorkingNode[]));
      }

      // Enqueue any facets that are nodes
      for (const [, array] of node.getAllFacetNodes()) {
        for (const value of array) {
          if (value instanceof WorkingNode) {
            toVisit.push(value);
          }
        }
      }
    }
  },
  updateNodeChildrenToHaveCorrectParentAndPathPartFromParent(
    node: WorkingNode,
    facet?: string,
    startingIndex?: number
  ) {
    if (facet) {
      const facetValue = node.getFacet(facet);
      if (!facetValue) {
        return;
      }

      const kids = facetValue as WorkingNode[];
      for (let i = startingIndex ?? 0; i < kids.length; i++) {
        const kid = kids[i];
        kid.parent = node;
        kid.pathPartFromParent = new PathPart(facet, i);
      }
    } else {
      if (!node.children) {
        return;
      }
      for (let i = startingIndex ?? 0; i < node.children.length; i++) {
        const kid = node.children[i] as WorkingNode;
        kid.pathPartFromParent = new PathPart(i);
        kid.parent = node;
      }
    }
  },
};
