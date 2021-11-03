/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {
  Document,
  FacetType,
  FacetValueType,
  Node,
  NodeCategory,
  NodeChildrenType,
  NodeType,
} from "../document-model-rd5";
import { Emblem, Emoji, FancyGrapheme, FancyText, Text } from "../text-model-rd4";
import {
  CursorNavigator,
  CursorOrientation,
  CursorPath,
  NodeNavigator,
  Path,
  PathPart,
  PseudoNode,
} from "../traversal-rd4";

import { AnchorParameters, WorkingAnchor, WorkingAnchorRange } from "./anchor";
import { WorkingDocumentError } from "./error";
import { AnchorPullDirection } from "./misc";
import { ReadonlyWorkingNode, WorkingDocumentNode, WorkingNode } from "./nodes";

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
  determineCursorPositionAfterDeletion(
    document: WorkingDocumentNode,
    deletionTarget: NodeNavigator,
    direction: AnchorPullDirection
  ): CursorNavigator {
    // The node that the `originalPosition` navigator is pointed to is now
    // deleted, along with (possibly) its parent and grandparent.
    const originalNode = deletionTarget.tip.node;
    const originalParent = deletionTarget.parent?.node;
    const isBack = direction === AnchorPullDirection.Backward;

    const n = new CursorNavigator<ReadonlyWorkingNode>(document);
    if (n.navigateFreelyTo(deletionTarget.path, CursorOrientation.On)) {
      if (PseudoNode.isGraphemeOrFancyGrapheme(originalNode)) {
        if (n.parent?.node === originalParent) {
          const currentIndex = n.tip.pathPart?.index;
          isBack ? n.navigateToPrecedingCursorPosition() : n.navigateToNextCursorPosition();

          // This fixes a bug where we navigate but the only thing that changed is
          // the CursorOrientation
          if (
            n.tip.pathPart &&
            n.tip.pathPart.index === currentIndex &&
            n.cursor.orientation === (isBack ? CursorOrientation.Before : CursorOrientation.After) &&
            (isBack ? n.toNodeNavigator().navigateToPrecedingSibling() : n.toNodeNavigator().navigateToNextSibling())
          ) {
            isBack ? n.navigateToPrecedingCursorPosition() : n.navigateToNextCursorPosition();
          }
          return n;
        }
        // OK we were able to navigate to the same cursor location but a different
        // node or parent node
        n.navigateFreelyToParent();
      }

      if (n.navigateFreelyToPrecedingSibling()) {
        if (
          direction === AnchorPullDirection.Forward &&
          n.tip.node instanceof Node &&
          n.tip.node.nodeType.category !== NodeCategory.Inline &&
          n.navigateFreelyToNextSibling()
        ) {
          n.navigateToFirstDescendantCursorPosition();
        } else {
          n.navigateToLastDescendantCursorPosition();
        }
      } else {
        n.navigateToFirstDescendantCursorPosition();
      }
    } else {
      // Try one level higher as a fallback
      const p = deletionTarget.path.withoutTip();
      if (n.navigateFreelyTo(new CursorPath(p, CursorOrientation.On))) {
        n.navigateToLastDescendantCursorPosition();
      } else {
        // OK try one more level higher again
        const p2 = deletionTarget.path.withoutTip().withoutTip();
        if (n.navigateFreelyTo(new CursorPath(p2, CursorOrientation.On))) {
          // Not sure this is really right...
          n.navigateToLastDescendantCursorPosition();
        } else {
          // Not sure this is really right...
          if (!n.navigateFreelyToDocumentNode() || !n.navigateToFirstDescendantCursorPosition()) {
            throw new WorkingDocumentError("Could not refresh navigator is not a valid cursor");
          }
        }
      }
    }
    return n;
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
  getNodeNavigator(document: WorkingDocumentNode, path: Path): NodeNavigator<WorkingNode> {
    const n = new NodeNavigator(document);
    if (!n.navigateTo(path)) {
      throw new WorkingDocumentError("Could not navigate to node.");
    }
    return n;
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
  isFancyGrapheme(value: any): value is FancyGrapheme {
    return typeof value === "string" || value instanceof Emoji || value instanceof Emblem;
  },
  isFancyText(value: any): value is FancyText {
    return Array.isArray(value) && !value.find((x) => !Utils.isFancyGrapheme(x));
  },
  isText(value: any): value is Text {
    return Array.isArray(value) && !value.find((x) => typeof x !== "string");
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
