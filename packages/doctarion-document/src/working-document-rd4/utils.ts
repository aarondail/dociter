import { NodeNavigator, Path } from "../basic-traversal-rd4";
import { Node } from "../document-model-rd4";

import { WorkingAnchor, WorkingAnchorRange } from "./anchor";
import { WorkingDocumentError } from "./error";
import { WorkingDocumentRootNode, WorkingNode } from "./nodes";

export const Utils = {
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
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
  isWorkingNode(value: any): value is WorkingNode {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return value.id !== undefined && value.attachedAnchors !== undefined && value instanceof Node;
  },
  *traverseAllAnchorsOriginatingFrom(node: WorkingNode): Iterable<WorkingAnchor> {
    for (const [, anchorOrRange] of node.getAllFacetAnchors()) {
      if (anchorOrRange instanceof WorkingAnchor) {
        yield anchorOrRange;
      } else if (anchorOrRange instanceof WorkingAnchorRange) {
        yield anchorOrRange.anterior;
        yield anchorOrRange.posterior;
      }
    }
  },
  *traverseNodeSubTree(node: WorkingNode): Iterable<WorkingNode> {
    const toVisit: WorkingNode[] = [node];
    while (toVisit.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
};
