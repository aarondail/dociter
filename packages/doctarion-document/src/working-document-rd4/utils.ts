/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { NodeNavigator, Path, PathPart, PseudoNode } from "../basic-traversal-rd4";
import { Document, Facet, Node, NodeChildrenType } from "../document-model-rd4";
import { Emblem, Emoji, FancyGrapheme, FancyText, Text } from "../text-model-rd4";

import { AnchorPayload, WorkingAnchor, WorkingAnchorRange } from "./anchor";
import { WorkingDocumentError } from "./error";
import { WorkingDocumentRootNode, WorkingNode } from "./nodes";

export const Utils = {
  canNodeBeSplit(node: PseudoNode): boolean {
    if (PseudoNode.isGrapheme(node) || node instanceof Document) {
      return false;
    }
    if (node.nodeType.childrenType === NodeChildrenType.None) {
      return false;
    }
    const workingNode = node as WorkingNode;
    // Return false if we think this node has no parent or it has one but it
    // isn't part of an array (either a facet NodeArray type or as part of the
    // children).
    if (!workingNode.pathPartFromParent || workingNode.pathPartFromParent.index === undefined) {
      return false;
    }
    return true;
  },
  getPathForNode(node: WorkingNode): Path {
    const tip = node;
    const parts = [];
    while (tip.pathPartFromParent) {
      parts.unshift(tip.pathPartFromParent);
    }
    return new Path(...parts);
  },
  getNodeNavigatorForNode(node: WorkingNode, document: WorkingDocumentRootNode): NodeNavigator {
    const n = new NodeNavigator(document);
    const path = Utils.getPathForNode(node);
    if (!n.navigateTo(path)) {
      throw new WorkingDocumentError("Could not navigate to node.");
    }
    return n;
  },
  isAnchorPayload(value: any): value is AnchorPayload {
    return value.node !== undefined && value.orientation !== undefined;
  },
  isAnchorPayloadPair(value: any): value is [AnchorPayload, AnchorPayload] {
    if (Array.isArray(value) && value.length === 2) {
      return Utils.isAnchorPayload(value[0]) && Utils.isAnchorPayload(value[1]);
    }
    return false;
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
  isWorkingNode(value: any): value is WorkingNode {
    return value.id !== undefined && value.attachedAnchors !== undefined && value instanceof Node;
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
      if (t.hasNodeChildren()) {
        if (n.children) {
          toVisit.push(...(n.children as WorkingNode[]));
        }
      }

      // Enqueue any facets that are nodes
      for (const [, array] of node.getAllFacetNodes()) {
        for (const value of array) {
          if (Utils.isWorkingNode(value)) {
            toVisit.push(value);
          }
        }
      }
    }
  },
  updateNodeChildrenToHaveCorrectParentAndPathPartFromParent(
    node: WorkingNode,
    facet?: Facet | undefined,
    startingIndex?: number
  ) {
    if (facet) {
      const facetValue = node.getFacetValue(facet);
      if (!facetValue) {
        return;
      }

      const kids = facetValue as WorkingNode[];
      for (let i = startingIndex ?? 0; i < kids.length; i++) {
        const kid = kids[i];
        kid.parent = node;
        kid.pathPartFromParent = new PathPart(facet.name, i);
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
