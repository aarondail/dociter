import { FriendlyIdGenerator } from "doctarion-utils";
import * as immer from "immer";
import { immerable } from "immer";
import lodash from "lodash";

import { Chain, NodeNavigator, Path } from "../basic-traversal";
import { Document, Node, NodeUtils, ObjectNode, Text } from "../models";

import { Anchor, AnchorId, AnchorOrientation } from "./anchor";
import { NodeAssociatedData, NodeId } from "./nodeAssociatedData";

export interface ReadonlyWorkingDocument {
  readonly document: Document;

  debug(): void;
  getAnchor(anchorId: AnchorId): Anchor | undefined;
  getId(node: Node): NodeId | undefined;
  lookupChainTo(nodeId: NodeId): Chain | undefined;
  lookupPathTo(nodeId: NodeId): Path | undefined;
  lookupNode(nodeId: NodeId): Node | undefined;
}

export class WorkingDocument {
  public document: Document;

  [immerable] = true;

  private anchors: { [id: string /* AnchorId */]: Anchor | undefined };
  // This big long object may be a poor fit for immer... not sure what to do about it though
  // private objectNodes: { [id: string /* NodeId */]: immer.Draft<ObjectNode> | undefined };
  private nodeParentIdMap: { [id: string /* NodeId */]: NodeId | undefined };

  public constructor(document: Document, private readonly idGenerator: FriendlyIdGenerator) {
    this.document = lodash.cloneDeep(document);
    this.anchors = {};
    this.nodeParentIdMap = {};

    // Assign initial node ids
    const n = new NodeNavigator(this.document);
    n.navigateToStartOfDfs();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.processNodeCreated(this.document as any, undefined);
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
    const resolvedNode = this.lookupNode(nodeId);
    if (!resolvedNode) {
      return undefined;
    }
    const anchor = new Anchor(anchorId, nodeId, orientation, graphemeIndex, name);
    NodeAssociatedData.addAnchorToNode(resolvedNode, anchorId);
    this.anchors[anchorId] = anchor;
    return anchor;
  }

  // TODO cleanup
  public debug(): void {
    const p = (s2: string, ind: number) => {
      let s = "";
      for (let i = 0; i < ind; i++) {
        s += " ";
      }
      s += s2;
      s += "\n";
      return s;
    };

    const debugPrime = (node: ObjectNode, ind: number) => {
      let s = "";
      s += p(`<${NodeAssociatedData.getId(node)} parent=${NodeAssociatedData.getParentId(node)}>`, ind);
      if (NodeUtils.isTextContainer(node)) {
        s += p('"' + Text.toString(node.children) + '"', ind + 2);
      } else {
        for (const k of NodeUtils.getChildren(node) || []) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          s += debugPrime(k as any, ind + 2);
        }
      }
      s += p(`</${NodeAssociatedData.getId(node)}>`, ind);
      return s;
    };

    console.log(debugPrime(this.document, 0));
    // console.log(JSON.stringify(this.nodeParentIdMap, undefined, 4));
  }

  public deleteAnchor(anchor: Anchor | AnchorId): void {
    const id = typeof anchor === "string" ? anchor : anchor.id;
    const resolvedAnchor = this.anchors[id];
    if (!resolvedAnchor) {
      return;
    }
    const oldNode = this.lookupNode(resolvedAnchor.nodeId);
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

  public lookupChainTo(nodeId: NodeId): Chain | undefined {
    // this.debug();
    const idChain = [];
    let currentId: string | undefined = nodeId;
    while (currentId) {
      idChain.push(currentId);
      currentId = this.nodeParentIdMap[currentId];
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
    const chain = this.lookupChainTo(nodeId);
    if (!chain) {
      return undefined;
    }
    return chain.tipNode;
  }

  public lookupPathTo(nodeId: NodeId): Path | undefined {
    const chain = this.lookupChainTo(nodeId);
    if (chain) {
      return chain.path;
    }
    return undefined;
  }

  // TODO this and other process methods should be private
  /**
   * When a new node is added to the document, this method must be called (the
   * exception being graphemes). This method assigns the node its id.
   */
  public processNodeCreated(node: ObjectNode, parent: Node | NodeId | undefined): NodeId | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const nodeId = this.idGenerator.generateId((node as any).kind || "DOCUMENT");
    const parentId = parent && (typeof parent === "string" ? parent : NodeAssociatedData.getId(parent));
    NodeAssociatedData.assignId(node, nodeId);
    parentId && NodeAssociatedData.assignParentId(node, parentId);
    this.nodeParentIdMap[nodeId] = parentId;
    return nodeId;
  }

  public processNodeDeleted(node: NodeId | ObjectNode): void {
    const id = typeof node === "string" ? node : NodeAssociatedData.getId(node);
    if (id) {
      delete this.nodeParentIdMap[id];
    }
  }

  public processNodeMoved(node: Node, newParent: NodeId | ObjectNode): void {
    const nodeId = NodeAssociatedData.getId(node);
    const parentId = typeof newParent === "string" ? newParent : NodeAssociatedData.getId(newParent);
    parentId && NodeAssociatedData.assignParentId(node, parentId);
    if (nodeId) {
      this.nodeParentIdMap[nodeId] = parentId;
    }
  }

  public updateAnchor(
    id: AnchorId,
    nodeId: NodeId,
    orientation: AnchorOrientation,
    graphemeIndex: number | undefined
  ): void {
    const anchor = this.anchors[id];
    if (!anchor) {
      return;
    }

    immer.castDraft(anchor).nodeId = nodeId;
    // if (updates.nodeId) {
    //   const nodeId = updates.nodeId; // typeof updates.node === "string" ? updates.node : NodeAssociatedData.getId(updates.node);
    //   if (!nodeId) {
    //     return undefined;
    //   }
    //   const newNode = this.nodeParentIdMap[nodeId];
    //   if (!newNode) {
    //     return undefined;
    //   }
    //   const oldNode = this.nodeParentIdMap[anchor.nodeId];
    //   if (oldNode) {
    //     NodeAssociatedData.removeAnchorFromNode(oldNode, anchor.id);
    //   }
    //   NodeAssociatedData.addAnchorToNode(newNode, anchor.id);
    // }
    immer.castDraft(anchor).orientation = orientation;
    immer.castDraft(anchor).graphemeIndex = graphemeIndex;
  }
}
