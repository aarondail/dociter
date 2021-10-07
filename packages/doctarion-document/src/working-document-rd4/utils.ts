/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { NodeNavigator, Path } from "../basic-traversal-rd4";
import { Node } from "../document-model-rd4";
import { Mutable } from "../miscUtils";
import { Emblem, Emoji, FancyGrapheme, FancyText, Text, TextStyle, TextStyleModifier } from "../text-model-rd4";

import { AnchorPayload, WorkingAnchor, WorkingAnchorRange } from "./anchor";
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
};
