import { FriendlyIdGenerator } from "doctarion-utils";
import * as immer from "immer";
import lodash from "lodash";

import { Chain, NodeNavigator } from "../basic-traversal";
import { Document, Node, NodeUtils, ObjectNode } from "../models";

import { NodeId } from "./nodeId";

export class WorkingDocument {
  /**
   * This should only be updated by the EditorNodeTrackingService.
   */
  // This big long object may be a poor fit for immer... not sure what to do about it though
  private nodeParentMap: { [id: string /* NodeId */]: NodeId | undefined };

  public constructor(
    /**
     * This document is expected to be in-use by only one WorkingDocument
     * instance at a time.
     */
    public readonly document: immer.Draft<Document>,
    private readonly idGenerator: FriendlyIdGenerator
  ) {
    this.nodeParentMap = {};

    // Assign initial node ids
    const n = new NodeNavigator(this.document);
    n.navigateToStartOfDfs();
    this.processNodeCreated(n.tip.node, undefined);
    n.traverseDescendants((node, parent) => this.processNodeCreated(node, parent), {
      skipGraphemes: true,
    });
  }

  public lookupChainTo(nodeId: NodeId): Chain | undefined {
    const idChain = [];
    let currentId: string | undefined = nodeId;
    while (currentId) {
      idChain.push(currentId);
      currentId = this.nodeParentMap[currentId];
    }
    idChain.reverse();

    const nav = new NodeNavigator(this.document);
    if (idChain.length === 0) {
      return undefined;
    }
    if (idChain[0] !== NodeId.getId(this.document)) {
      return undefined;
    }
    // Now walk the chain and find the matching nodes
    for (const id of idChain.slice(1)) {
      const children = NodeUtils.getChildren(nav.tip.node);
      if (!children) {
        return undefined;
      }
      const index = children.findIndex((n: Node) => NodeId.getId(n) === id);
      if (index === -1) {
        return undefined;
      }
      nav.navigateToChild(index);
    }
    return nav.chain;
  }

  /**
   * This is not a constant time (or equivalent) operation, but it should be
   * pretty fast.
   */
  public lookupNode(nodeId: NodeId): Node | undefined {
    const chain = this.lookupChainTo(nodeId);
    if (chain) {
      const lastLink = lodash.last(chain.links);
      if (lastLink) {
        return lastLink.node;
      }
    }
    return undefined;
  }

  /**
   * When a new node is added to the document, this method must be called (the
   * exception being graphemes). This method assigns the node its id.
   */
  private processNodeCreated(node: Node, parent: Node | undefined): NodeId | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const nodeId = this.idGenerator.generateId((node as any).kind || "DOCUMENT");
    NodeId.assignId(node, nodeId);

    const parentId = parent && NodeId.getId(parent);
    if (parentId) {
      this.nodeParentMap[nodeId] = parentId;
    }

    return nodeId;
  }

  /**
   * When a node is removed from the document this must be called. If the node
   * is just moved to a new parent, the `notifyNodeMoved` method should be called.
   */
  private processNodeDeleted(node: Node): void {
    const id = NodeId.getId(node);
    if (id) {
      delete this.nodeParentMap[id];
    }
  }

  private processNodeMoved(node: Node, newParent: NodeId | ObjectNode): void {
    const id = NodeId.getId(node);
    if (id) {
      if (newParent instanceof ObjectNode) {
        this.nodeParentMap[id] = NodeId.getId(newParent);
      } else {
        this.nodeParentMap[id] = newParent;
      }
    }
  }
}
