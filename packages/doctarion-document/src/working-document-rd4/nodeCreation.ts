import { FriendlyIdGenerator } from "doctarion-utils";
import lodash from "lodash";

import { Anchor, AnchorRange, Node, Span } from "../document-model-rd5";
import { TextStyleStrip } from "../text-model-rd4";
import { PathPart } from "../traversal-rd4";

import { AnchorId, WorkingAnchor, WorkingAnchorRange } from "./anchor";
import { WorkingDocumentError } from "./error";
import { NodeId, WorkingDocumentNode, WorkingNode, WorkingNodeOfType } from "./nodes";
import { WorkingTextStyleStrip } from "./textStyleStrip";

export function createWorkingNode(
  idGenerator: FriendlyIdGenerator,
  root: Node,
  existingNodes?: Map<NodeId, WorkingNode>,
  options?: { joinAdjacentSpans: boolean }
): { root: WorkingNode; newNodes: Map<NodeId, WorkingNode>; newAnchors: Map<AnchorId, WorkingAnchor> } {
  const nodeToWorkingNodeMap: Map<
    Node,
    { workingNode: WorkingNode; mergedIntoPriorSibling?: boolean; mergedGraphemeOffset?: number }
  > = new Map();
  const newAnchors: Map<AnchorId, WorkingAnchor> = new Map();
  const newNodes: Map<NodeId, WorkingNode> = new Map();

  const mapPropertyValue = (value: any, container: WorkingNode, propertyName: string, index?: number): any => {
    if (value instanceof WorkingAnchor) {
      throw new WorkingDocumentError("Cannot create a working node from a node that contains a WorkingAnchor already");
    } else if (value instanceof WorkingAnchorRange) {
      throw new WorkingDocumentError(
        "Cannot create a working node from a node that contains a WorkingAnchorRange already"
      );
    } else if (value instanceof WorkingNode) {
      throw new WorkingDocumentError("Cannot create a working node from a node that contains a WorkingNode already");
    } else if (value instanceof Anchor) {
      // Note that usually (e.g. when the Document is being turned into a
      // WorkingDocumentRootNode) this Anchor will (incorrectly) have a normal
      // node (not a WorkingNode) as its `.node` property. This has to be fixed
      // up below after we are done creating WorkingNodes (the reason we do this
      // is that the Node the Anchor points to may not have been turned into a
      // WorkingNode yet).
      const anchor = anchorToWorkingAnchor(idGenerator, value, container);
      newAnchors.set(anchor.id, anchor);
      return anchor;
    } else if (value instanceof AnchorRange) {
      // See note above about how the Anchors created will sometimes
      // (incorrectly) have the original Anchor's node (not a WorkingNode), yet.
      const anchors = anchorRangeToWorkingAnchors(idGenerator, value, container);
      newAnchors.set(anchors.from.id, anchors.from);
      newAnchors.set(anchors.to.id, anchors.to);
      return anchors;
    } else if (value instanceof Node) {
      const n = mapNode(value);
      n.parent = container;
      n.pathPartFromParent =
        propertyName === "children"
          ? new PathPart(index!)
          : index === undefined
          ? new PathPart(propertyName)
          : new PathPart(propertyName, index);
      return n;
    } else if (value instanceof TextStyleStrip) {
      return createWorkingTextStyleStrip(value);
    } else if (Array.isArray(value)) {
      return value.map((v, idx) => mapPropertyValue(v, container, propertyName, idx));
    } else {
      // This could DEFINITELY do the wrong thing but hopefully the fact
      // that our WorkingXyz types use NodePropertyToWorkingNodeProperty
      // which maps unknown cases to never will catch things.
      return lodash.clone(value);
    }
  };

  function mergeAdjacentSpan(priorSpan: WorkingNodeOfType<typeof Span>, newSpan: Node<typeof Span>) {
    const oldLength = priorSpan.children.length;
    priorSpan.children.push(...(newSpan.children as any[]));
    // Merge the styles if any
    if (newSpan.getFacet("styles")) {
      if (priorSpan.facets.styles === undefined) {
        priorSpan.facets.styles = new WorkingTextStyleStrip([]);
      }
      priorSpan.facets.styles.updateForAppend(oldLength, newSpan.getFacet("styles") as TextStyleStrip);
    }
    // Set this so later we can update anchors on the node (we merged from) properly
    nodeToWorkingNodeMap.set(newSpan, {
      workingNode: priorSpan,
      mergedIntoPriorSibling: true,
      mergedGraphemeOffset: oldLength,
    });
  }

  const mapNode = (node: Node): WorkingNode => {
    const id = idGenerator.generateId(node.nodeType.name);
    const newNode = new WorkingNode(node.nodeType, id);
    newNodes.set(id, newNode);
    nodeToWorkingNodeMap.set(node, { workingNode: newNode });

    {
      let idx = 0;
      let priorSpanChild: WorkingNodeOfType<typeof Span> | undefined = undefined;
      for (const child of node.children) {
        if (child instanceof Node) {
          if (options?.joinAdjacentSpans && child.nodeType === Span && priorSpanChild) {
            // Merge the child into the existing (priorChild)
            mergeAdjacentSpan(priorSpanChild, child);
          } else {
            const newChild = mapPropertyValue(child, newNode, "children", idx);
            (newNode.children as any[]).push(newChild);
            priorSpanChild = child.nodeType === Span ? newChild : undefined;
          }
        } else {
          // It should be a string or an immutable Emoji or Emblem already
          (newNode.children as any[]).push(child);
          priorSpanChild = undefined;
        }
        idx++;
      }
    }
    for (const [name, value] of Object.entries(node.facets)) {
      newNode.setFacet(name, mapPropertyValue(value, newNode, name));
    }

    return newNode;
  };

  const newRoot = mapNode(root);

  // Fix up anchor target nodes
  for (const workingAnchor of newAnchors.values()) {
    const anchorOriginalTarget: Node = workingAnchor.node;
    if (anchorOriginalTarget instanceof WorkingNode) {
      // This case should only be hit if the Anchor (from one of the Nodes being
      // converted to WorkingNodes) points to an already existing WorkingNode
      // somewhere else in the document.
      //
      // Make sure the target actually exists in the target
      if (existingNodes?.get(anchorOriginalTarget.id) !== anchorOriginalTarget) {
        throw new WorkingDocumentError("Anchor has node that is a WorkingNode but is not part of the WorkingDocument");
      }
      anchorOriginalTarget.attachedAnchors.set(workingAnchor.id, workingAnchor);
    } else {
      const m = nodeToWorkingNodeMap.get(anchorOriginalTarget);
      if (!m) {
        throw new WorkingDocumentError("Could not find WorkingNode to assign to new WorkingAnchor");
      }
      workingAnchor.node = m.workingNode;
      m.workingNode.attachedAnchors.set(workingAnchor.id, workingAnchor);
      if (m.mergedIntoPriorSibling && workingAnchor.graphemeIndex !== undefined) {
        workingAnchor.graphemeIndex += m.mergedGraphemeOffset!;
      }
    }
  }

  return { root: newRoot as WorkingDocumentNode, newNodes, newAnchors };
}

export function cloneWorkingNodeAsEmptyRegularNode(root: WorkingNode): Node {
  const mapFacet = (value: any): any => {
    if (value instanceof Anchor) {
      throw new WorkingDocumentError("Cannot create an empty clone of a WorkingNode that has an Anchor");
    } else if (value instanceof AnchorRange) {
      throw new WorkingDocumentError("Cannot create an empty clone of a WorkingNode that has an AnchorRange");
    } else if (value instanceof Node) {
      throw new WorkingDocumentError(
        "Cannot create an empty clone of a WorkingNode that has a Node (not array) property"
      );
    } else if (value instanceof TextStyleStrip) {
      return new TextStyleStrip();
    } else if (Array.isArray(value)) {
      return [];
    } else {
      // This could DEFINITELY do the wrong thing but hopefully does not.
      return lodash.clone(value);
    }
  };

  const mapNode = (node: WorkingNode): Node => {
    const facets = {} as any;
    if (node.nodeType.facets) {
      for (const [name] of Object.entries(node.nodeType.facets)) {
        const value = node.getFacet(name);
        facets[name] = mapFacet(value);
      }
    }

    const newNode = new Node(node.nodeType, [], facets);

    return newNode;
  };

  const newRoot = mapNode(root);
  return newRoot;
}

function anchorToWorkingAnchor(
  idGenerator: FriendlyIdGenerator,
  anchor: Anchor,
  originNode: WorkingNode
): WorkingAnchor {
  return new WorkingAnchor(
    idGenerator.generateId("ANCHOR"),
    anchor.node as any, // Yes this is wrong but will be fixed up (see section around fixing up anchor target nodes above)
    anchor.orientation,
    anchor.graphemeIndex,
    undefined,
    undefined,
    originNode
  );
}

function anchorRangeToWorkingAnchors(
  idGenerator: FriendlyIdGenerator,
  anchors: AnchorRange,
  originNode: WorkingNode
): WorkingAnchorRange {
  return new WorkingAnchorRange(
    anchorToWorkingAnchor(idGenerator, anchors.from, originNode),
    anchorToWorkingAnchor(idGenerator, anchors.to, originNode)
  );
}

export function createWorkingTextStyleStrip(strip: TextStyleStrip): WorkingTextStyleStrip {
  return new WorkingTextStyleStrip(strip.entries);
}
