import { FriendlyIdGenerator } from "doctarion-utils";
import * as immer from "immer";

import { Chain, NodeNavigator } from "../basic-traversal";
import { Document, Node, NodeUtils, ObjectNode } from "../models";

import { Anchor, AnchorId, AnchorOrientation } from "./anchor";
import { NodeAssociatedData, NodeId } from "./nodeAssociatedData";

export class WorkingDocument {
  private anchors: { [id: string /* AnchorId */]: immer.Draft<Anchor> | undefined };
  // This big long object may be a poor fit for immer... not sure what to do about it though
  private objectNodes: { [id: string /* NodeId */]: immer.Draft<ObjectNode> | undefined };

  public constructor(
    /**
     * This document is expected to be in-use by only one WorkingDocument
     * instance at a time.
     */
    public readonly document: immer.Draft<Document>,
    private readonly idGenerator: FriendlyIdGenerator
  ) {
    this.anchors = {};
    this.objectNodes = {};

    // Assign initial node ids
    const n = new NodeNavigator(this.document);
    n.navigateToStartOfDfs();
    this.processNodeCreated(this.document, undefined);
    n.traverseDescendants((node, parent) => this.processNodeCreated(node as immer.Draft<ObjectNode>, parent), {
      skipGraphemes: true,
    });
  }

  public createAnchor(
    node: NodeId | ObjectNode,
    orientation: AnchorOrientation,
    graphemeIndex?: number,
    name?: string
  ): Anchor | undefined {
    const anchorId = this.idGenerator.generateId("ANCHOR");
    const nodeId = typeof node === "string" ? node : NodeAssociatedData.getId(node);
    if (!nodeId) {
      return undefined;
    }
    const resolvedNode = this.objectNodes[nodeId];
    if (!resolvedNode) {
      return undefined;
    }
    const anchor = new Anchor(anchorId, nodeId, orientation, graphemeIndex, name);
    NodeAssociatedData.addAnchorToNode(resolvedNode, anchorId);
    this.anchors[anchorId] = anchor;
    return anchor;
  }

  public deleteAnchor(anchor: Anchor | AnchorId): void {
    const id = typeof anchor === "string" ? anchor : anchor.id;
    const resolvedAnchor = this.anchors[id];
    if (!resolvedAnchor) {
      return;
    }
    const oldNode = this.objectNodes[resolvedAnchor.nodeId];
    if (oldNode) {
      NodeAssociatedData.removeAnchorFromNode(oldNode, resolvedAnchor.id);
    }
    delete this.anchors[id];
  }

  public getAnchor(anchorId: AnchorId): Anchor | undefined {
    return this.anchors[anchorId];
  }

  public getId(node: Node): NodeId | undefined {
    return NodeAssociatedData.getId(node);
  }

  public getNode(nodeId: NodeId): ObjectNode | undefined {
    return this.objectNodes[nodeId];
  }

  public lookupChainTo(nodeId: NodeId): Chain | undefined {
    const idChain = [];
    let currentId: string | undefined = nodeId;
    while (currentId) {
      idChain.push(currentId);
      const node = this.objectNodes[currentId];
      if (!node) {
        break;
      }
      currentId = NodeAssociatedData.getParentId(node);
    }
    idChain.reverse();

    const nav = new NodeNavigator(this.document);
    if (idChain.length === 0) {
      return undefined;
    }
    if (idChain[0] !== NodeAssociatedData.getId(this.document)) {
      return undefined;
    }
    // Now walk the chain and find the matching nodes
    for (const id of idChain.slice(1)) {
      const children = NodeUtils.getChildren(nav.tip.node);
      if (!children) {
        return undefined;
      }
      const index = children.findIndex((n: Node) => NodeAssociatedData.getId(n) === id);
      if (index === -1) {
        return undefined;
      }
      nav.navigateToChild(index);
    }
    return nav.chain;
  }

  public lookupNode(nodeId: NodeId): Node | undefined {
    return this.objectNodes[nodeId];
  }

  public updateAnchor(
    id: AnchorId,
    updates: {
      readonly node?: NodeId | ObjectNode;
      readonly orientation?: AnchorOrientation;
      readonly graphemeIndex?: number;
    }
  ): void {
    const anchor = this.anchors[id];
    if (!anchor) {
      return;
    }

    if (updates.node) {
      const nodeId = typeof updates.node === "string" ? updates.node : NodeAssociatedData.getId(updates.node);
      if (!nodeId) {
        return undefined;
      }
      const newNode = this.objectNodes[nodeId];
      if (!newNode) {
        return undefined;
      }
      const oldNode = this.objectNodes[anchor.nodeId];
      if (oldNode) {
        NodeAssociatedData.removeAnchorFromNode(oldNode, anchor.id);
      }
      NodeAssociatedData.addAnchorToNode(newNode, anchor.id);
    }
    if (updates.orientation !== undefined) {
      anchor.orientation = updates.orientation;
    }
    if (updates.graphemeIndex !== undefined) {
      anchor.graphemeIndex = updates.graphemeIndex;
    }
  }

  /**
   * When a new node is added to the document, this method must be called (the
   * exception being graphemes). This method assigns the node its id.
   */
  private processNodeCreated(node: immer.Draft<ObjectNode>, parent: Node | NodeId | undefined): NodeId | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const nodeId = this.idGenerator.generateId((node as any).kind || "DOCUMENT");
    const parentId = parent && (typeof parent === "string" ? parent : NodeAssociatedData.getId(parent));
    NodeAssociatedData.assignId(node, nodeId);
    parentId && NodeAssociatedData.assignParentId(node, parentId);
    this.objectNodes[nodeId] = node;
    return nodeId;
  }

  private processNodeDeleted(node: NodeId | ObjectNode): void {
    const id = typeof node === "string" ? node : NodeAssociatedData.getId(node);
    if (id) {
      delete this.objectNodes[id];
    }
  }

  private processNodeMoved(node: Node, newParent: NodeId | ObjectNode): void {
    const parentId = typeof newParent === "string" ? newParent : NodeAssociatedData.getId(newParent);
    parentId && NodeAssociatedData.assignParentId(node, parentId);
  }
}
