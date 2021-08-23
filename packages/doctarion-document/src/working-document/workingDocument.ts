import { FriendlyIdGenerator } from "doctarion-utils";
import * as immer from "immer";
import { immerable } from "immer";
import lodash from "lodash";

import { Chain, NodeNavigator, Path } from "../basic-traversal";
import { Document, Node, NodeUtils, ObjectNode, Text } from "../models";

import { Anchor, AnchorId, AnchorOrientation, AnchorPosition } from "./anchor";
import { WorkingDocumentError } from "./error";
import { WorkingDocumentEventEmitter, WorkingDocumentEvents } from "./events";
import { Interactor, InteractorAnchorType, InteractorId, InteractorStatus } from "./interactor";
import { NodeAssociatedData, NodeId } from "./nodeAssociatedData";

export interface ReadonlyWorkingDocument {
  readonly document: Document;

  debug(): void;
  getAllInteractors(): readonly Interactor[];
  getAnchor(anchorId: AnchorId): Anchor | undefined;
  getId(node: Node): NodeId | undefined;
  getInteractor(interactorId: InteractorId): Interactor | undefined;
  lookupChainTo(nodeId: NodeId): Chain | undefined;
  lookupPathTo(nodeId: NodeId): Path | undefined;
  lookupNode(nodeId: NodeId): Node | undefined;
}

export class WorkingDocument implements ReadonlyWorkingDocument {
  public readonly document: Document;
  public readonly events: WorkingDocumentEvents;

  [immerable] = true;

  private readonly anchors: { [id: string /* AnchorId */]: Anchor | undefined };
  private readonly eventEmitters: WorkingDocumentEventEmitter;
  private readonly interactors: { [id: string /* AnchorId */]: Interactor | undefined };
  // This big long object may be a poor fit for immer... not sure what to do about it though
  // private objectNodes: { [id: string /* NodeId */]: immer.Draft<ObjectNode> | undefined };
  private readonly nodeParentIdMap: { [id: string /* NodeId */]: NodeId | undefined };

  public constructor(document: Document, private readonly idGenerator: FriendlyIdGenerator) {
    this.document = lodash.cloneDeep(document);
    this.anchors = {};
    this.interactors = {};
    this.nodeParentIdMap = {};

    this.eventEmitters = new WorkingDocumentEventEmitter();
    this.events = this.eventEmitters;

    // Assign initial node ids
    const n = new NodeNavigator(this.document);
    n.navigateToStartOfDfs();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.processNodeCreated(this.document as any, undefined);
    n.traverseDescendants((node, parent) => this.processNodeCreated(node as immer.Draft<ObjectNode>, parent), {
      skipGraphemes: true,
    });
  }

  public addAnchor(
    node: NodeId | ObjectNode,
    orientation: AnchorOrientation,
    graphemeIndex?: number,
    name?: string,
    relatedInteractorId?: InteractorId
  ): Anchor {
    const anchorId = this.idGenerator.generateId("ANCHOR");
    const nodeId = typeof node === "string" ? node : NodeAssociatedData.getId(node);
    if (!nodeId) {
      throw new WorkingDocumentError("Node is missing id");
    }
    const resolvedNode = this.lookupNode(nodeId);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Node could not be found in document");
    }
    const anchor = new Anchor(anchorId, nodeId, orientation, graphemeIndex, name, relatedInteractorId);
    // NodeAssociatedData.addAnchorToNode(resolvedNode, anchorId);
    this.anchors[anchorId] = anchor;

    if (relatedInteractorId) {
      this.eventEmitters.interactorUpdated.emit(relatedInteractorId);
    }
    return anchor;
  }

  public addInteractor(options: {
    at: AnchorPosition;
    selectTo?: AnchorPosition;
    status?: InteractorStatus;
    name?: string;
    lineMovementHorizontalVisualPosition?: number;
  }): Interactor {
    const { name, status, at, ...otherOptions } = options;
    const id = this.idGenerator.generateId("INTERACTOR");
    // We are giving this an undefined mainAnchor, which is cheating, but is
    // convenient here. We set it in updateInteractor so its ok.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newInteractor = new Interactor(id, undefined as any, status, undefined, undefined, name);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.interactors[id] = newInteractor;
    this.updateInteractor(id, { to: at, ...otherOptions });
    this.eventEmitters.interactorUpdated.emit(id);
    return newInteractor;
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
      throw new WorkingDocumentError("Could not find anchor");
    }
    const oldNode = this.lookupNode(resolvedAnchor.nodeId);
    if (oldNode) {
      // NodeAssociatedData.removeAnchorFromNode(oldNode, resolvedAnchor.id);
    }
    delete this.anchors[id];

    if (resolvedAnchor.relatedInteractorId) {
      this.eventEmitters.interactorUpdated.emit(resolvedAnchor.relatedInteractorId);
    }
  }

  public deleteInteractor(interactor: Interactor | InteractorId): void {
    const actualInteractor = typeof interactor === "string" ? this.interactors[interactor] : interactor;
    if (!actualInteractor) {
      throw new WorkingDocumentError("Could not find interactor");
    }

    this.deleteAnchor(actualInteractor.mainAnchor);
    actualInteractor.selectionAnchor && this.deleteAnchor(actualInteractor.selectionAnchor);
    delete this.interactors[actualInteractor.id];

    this.eventEmitters.interactorUpdated.emit(actualInteractor.id);
  }

  public getAllInteractors(): Interactor[] {
    return Object.values(this.interactors) as Interactor[];
  }

  public getAnchor(anchorId: AnchorId): Anchor | undefined {
    return this.anchors[anchorId];
  }

  public getId(node: Node): NodeId | undefined {
    return NodeAssociatedData.getId(node);
  }

  public getInteractor(id: InteractorId): Interactor | undefined {
    return this.interactors[id];
  }

  public getInteractorAnchor(id: InteractorId | Interactor, anchorType: InteractorAnchorType): Anchor | undefined {
    const interactor = typeof id === "string" ? this.interactors[id] : id;
    if (!interactor) {
      return undefined;
    }
    const anchorId = interactor.getAnchor(anchorType);
    return anchorId ? this.getAnchor(anchorId) : undefined;
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

    if (anchor.relatedInteractorId) {
      this.eventEmitters.interactorUpdated.emit(anchor.relatedInteractorId);
    }
  }

  public updateInteractor(
    id: InteractorId,
    options: {
      to?: AnchorPosition;
      selectTo?: AnchorPosition | "main";
      status?: InteractorStatus;
      name?: string;
      lineMovementHorizontalVisualPosition?: number;
    }
  ): void {
    const interactor = immer.castDraft(this.interactors[id]);
    if (!interactor) {
      throw new WorkingDocumentError("Could not find interactor");
    }

    if ("lineMovementHorizontalVisualPosition" in options) {
      interactor.lineMovementHorizontalVisualPosition = options.lineMovementHorizontalVisualPosition;
    }

    if ("selectTo" in options) {
      if (options.selectTo) {
        let anchorInfo: AnchorPosition | undefined;
        if (options.selectTo === "main") {
          anchorInfo = this.getAnchor(interactor.mainAnchor);
          if (!anchorInfo) {
            throw new WorkingDocumentError("Interactor is missing main anchor");
          }
        } else {
          anchorInfo = options.selectTo;
        }
        if (interactor.selectionAnchor) {
          const anchor = this.getAnchor(interactor.selectionAnchor);
          if (!anchor) {
            throw new WorkingDocumentError("Interactor is missing selection anchor in WorkingDocument");
          }
          immer.castDraft(anchor).nodeId = anchorInfo.nodeId;
          immer.castDraft(anchor).orientation = anchorInfo.orientation;
          immer.castDraft(anchor).graphemeIndex = anchorInfo.graphemeIndex;
        } else {
          const anchor = this.addAnchor(
            anchorInfo.nodeId,
            anchorInfo.orientation,
            anchorInfo.graphemeIndex,
            interactor.name ? interactor.name + "-SELECTION" : undefined,
            id
          );
          interactor.selectionAnchor = anchor.id;
        }
      } else {
        if (interactor.selectionAnchor) {
          this.deleteAnchor(interactor.selectionAnchor);
        }
        interactor.selectionAnchor = undefined;
      }
    }

    if (options.to) {
      const anchorInfo = options.to;
      if (interactor.mainAnchor) {
        const mainAnchor = this.getAnchor(interactor.mainAnchor);
        if (!mainAnchor) {
          throw new WorkingDocumentError("Interactor is missing main anchor in WorkingDocument");
        }
        immer.castDraft(mainAnchor).nodeId = anchorInfo.nodeId;
        immer.castDraft(mainAnchor).orientation = anchorInfo.orientation;
        immer.castDraft(mainAnchor).graphemeIndex = anchorInfo.graphemeIndex;
      } else {
        const mainAnchor = this.addAnchor(
          anchorInfo.nodeId,
          anchorInfo.orientation,
          anchorInfo.graphemeIndex,
          interactor.name ? interactor.name + "-MAIN" : undefined,
          id
        );
        interactor.mainAnchor = mainAnchor.id;
      }
    }

    if ("name" in options) {
      interactor.name = options.name;
    }

    if (options.status) {
      interactor.status = options.status;
    }

    this.eventEmitters.interactorUpdated.emit(interactor.id);
  }
}
