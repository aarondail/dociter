/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { NodeNavigator, Path, PathPart, PseudoNode } from "../basic-traversal-rd4";
import { Cursor, CursorNavigator, CursorOrientation } from "../cursor-traversal-rd4";
import {
  Anchor,
  AnchorOrientation,
  Document,
  Facet,
  Node,
  NodeCategory,
  NodeChildrenType,
} from "../document-model-rd4";
import { Emblem, Emoji, FancyGrapheme, FancyText, Text } from "../text-model-rd4";

import { AnchorParameters, WorkingAnchor, WorkingAnchorRange } from "./anchor";
import { WorkingDocumentError } from "./error";
import { FlowDirection } from "./misc";
import { WorkingDocumentRootNode, WorkingNode } from "./nodes";

export const Utils = {
  canNodeBeSplit(node: PseudoNode): boolean {
    if (PseudoNode.isGraphemeOrFancyGrapheme(node) || node instanceof Document) {
      return false;
    }
    if ((node as Node).nodeType.childrenType === NodeChildrenType.None) {
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
  determineCursorPositionAfterDeletion(
    document: WorkingDocumentRootNode,
    deletionTarget: NodeNavigator,
    direction: FlowDirection
  ): CursorNavigator {
    // The node that the `originalPosition` navigator is pointed to is now
    // deleted, along with (possibly) its parent and grandparent.
    const originalNode = deletionTarget.tip.node;
    const originalParent = deletionTarget.parent?.node;
    const isBack = direction === FlowDirection.Backward;

    const n = new CursorNavigator(document);
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
          direction === FlowDirection.Forward &&
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
      if (n.navigateFreelyTo(new Cursor(p, CursorOrientation.On))) {
        n.navigateToLastDescendantCursorPosition();
      } else {
        // OK try one more level higher again
        const p2 = deletionTarget.path.withoutTip().withoutTip();
        if (n.navigateFreelyTo(new Cursor(p2, CursorOrientation.On))) {
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
  getAnchorParametersFromCursorNavigator(cursorNavigator: CursorNavigator): AnchorParameters {
    const node = cursorNavigator.tip.node;
    if (PseudoNode.isGraphemeOrFancyGrapheme(node)) {
      const parent = cursorNavigator.parent?.node;
      if (!parent) {
        throw new WorkingDocumentError("Grapheme lacks parent");
      }
      return {
        node: parent as WorkingNode,
        orientation: (cursorNavigator.cursor.orientation as unknown) as AnchorOrientation,
        graphemeIndex: cursorNavigator.tip.pathPart.index,
      };
    }
    return {
      node: node as WorkingNode,
      orientation: (cursorNavigator.cursor.orientation as unknown) as AnchorOrientation,
      graphemeIndex: undefined,
    };
  },
  getNodeNavigator(document: WorkingDocumentRootNode, path: Path): NodeNavigator {
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
