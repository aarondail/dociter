import { FriendlyIdGenerator } from "doctarion-utils";

import { Document } from "../document-model-rd4";

import { AnchorId, AnchorPayload, ReadonlyWorkingAnchor, WorkingAnchor } from "./anchor";
import { createWorkingDocumentRootNode } from "./createWorkingDocumentRootNode";
import { WorkingDocumentError } from "./error";
import { WorkingDocumentEventEmitter, WorkingDocumentEvents } from "./events";
import { Interactor, InteractorId, InteractorPayload, ReadonlyInteractor } from "./interactor";
import {
  NodeId,
  ReadonlyWorkingDocumentRootNode,
  ReadonlyWorkingNode,
  WorkingDocumentRootNode,
  WorkingNode,
} from "./nodes";

export interface ReadonlyWorkingDocument {
  readonly allAnchors: ReadonlyMap<AnchorId, ReadonlyWorkingAnchor>;
  readonly document: ReadonlyWorkingDocumentRootNode;
  readonly interactors: ReadonlyMap<InteractorId, ReadonlyInteractor>;
  readonly nodes: ReadonlyMap<NodeId, ReadonlyWorkingNode>;

  // getId(node: Node): NodeId | undefined;
  // getInteractor(interactorId: InteractorId): Interactor | undefined;
  // lookupChainTo(nodeId: NodeId): Chain | undefined;
  // lookupPathTo(nodeId: NodeId): Path | undefined;
  // lookupNode(nodeId: NodeId): Node | undefined;
}

export class WorkingDocument implements ReadonlyWorkingDocument {
  private readonly actualDocument: WorkingDocumentRootNode;
  private readonly anchorLookup: Map<AnchorId, WorkingAnchor>;
  private readonly eventEmitters: WorkingDocumentEventEmitter;
  private readonly interactorLookup: Map<InteractorId, Interactor>;
  private readonly nodeLookup: Map<NodeId, WorkingNode>;

  public constructor(
    document: Document,
    private readonly idGenerator: FriendlyIdGenerator = new FriendlyIdGenerator()
  ) {
    this.anchorLookup = new Map<AnchorId, WorkingAnchor>();
    this.eventEmitters = new WorkingDocumentEventEmitter();
    this.interactorLookup = new Map<InteractorId, Interactor>();

    const { root, nodes, anchors } = createWorkingDocumentRootNode(this.idGenerator, document);
    this.actualDocument = root;
    this.anchorLookup = anchors;
    this.nodeLookup = nodes;
  }

  public get allAnchors(): ReadonlyMap<AnchorId, ReadonlyWorkingAnchor> {
    return this.anchorLookup;
  }
  public get document(): ReadonlyWorkingDocumentRootNode {
    return this.actualDocument;
  }
  public get events(): WorkingDocumentEvents {
    return this.eventEmitters;
  }
  public get interactors(): ReadonlyMap<InteractorId, ReadonlyInteractor> {
    return this.interactorLookup;
  }
  public get nodes(): ReadonlyMap<NodeId, ReadonlyWorkingNode> {
    return this.nodeLookup;
  }

  public addAnchor(payload: AnchorPayload): ReadonlyWorkingAnchor {
    const { node, orientation, graphemeIndex, name } = payload;
    const nodeId = typeof node === "string" ? node : node.id;
    const resolvedNode = this.nodeLookup.get(nodeId);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Node could not be found in document");
    }
    const anchorId = this.idGenerator.generateId("ANCHOR");
    const anchor = new WorkingAnchor(anchorId, resolvedNode, orientation, graphemeIndex, name);
    this.anchorLookup.set(anchorId, anchor);
    resolvedNode.attachedAnchors.set(anchorId, anchor);

    this.eventEmitters.anchorAdded.emit(anchor);

    return anchor;
  }

  public addInteractor(payload: InteractorPayload & Partial<Pick<InteractorPayload, "status">>): ReadonlyInteractor {
    const id = this.idGenerator.generateId("INTERACTOR");

    const mainAnchor = this.addAnchor(
      payload.name ? { ...payload.mainAnchor, name: payload.name + "-MAIN" } : payload.mainAnchor
    ) as WorkingAnchor;
    const selectionAnchor = payload.selectionAnchor
      ? (this.addAnchor(
          payload.name ? { ...payload.selectionAnchor, name: payload.name + "-SELECTION" } : payload.selectionAnchor
        ) as WorkingAnchor)
      : undefined;

    const newInteractor = new Interactor(
      id,
      mainAnchor,
      payload.status,
      selectionAnchor,
      payload.lineMovementHorizontalVisualPosition,
      payload.name
    );
    this.interactorLookup.set(id, newInteractor);
    mainAnchor.relatedInteractor = newInteractor;
    if (selectionAnchor) {
      selectionAnchor.relatedInteractor = newInteractor;
    }

    this.eventEmitters.interactorAdded.emit(newInteractor);

    return newInteractor;
  }

  public deleteAnchor(anchor: ReadonlyWorkingAnchor | AnchorId): void {
    this.deleteAnchorPrime(anchor);
  }

  public deleteInteractor(interactor: InteractorId | ReadonlyInteractor): void {
    const resolvedInteractor = this.interactorLookup.get(typeof interactor === "string" ? interactor : interactor.id);
    if (!resolvedInteractor) {
      throw new WorkingDocumentError("Unknown interactor");
    }
    this.deleteAnchorPrime(resolvedInteractor.mainAnchor, true);
    if (resolvedInteractor.selectionAnchor) {
      this.deleteAnchorPrime(resolvedInteractor.selectionAnchor, true);
    }
    this.interactorLookup.delete(resolvedInteractor.id);
    this.eventEmitters.interactorDeleted.emit(resolvedInteractor);
  }

  public updateAnchor(anchor: AnchorId | ReadonlyWorkingAnchor, payload: Partial<AnchorPayload>): void {
    const resolvedAnchor = this.anchorLookup.get(typeof anchor === "string" ? anchor : anchor.id);
    if (!resolvedAnchor) {
      throw new WorkingDocumentError("Unknown anchor");
    }

    if (payload.node) {
      const oldNode = resolvedAnchor.node;
      const nodeId = typeof payload.node === "string" ? payload.node : payload.node.id;
      const resolvedNode = this.nodeLookup.get(nodeId);
      if (!resolvedNode) {
        throw new WorkingDocumentError("Node could not be found in document");
      }
      if (resolvedNode !== oldNode) {
        resolvedAnchor.node = resolvedNode;
        oldNode.attachedAnchors.delete(resolvedAnchor.id);
        resolvedNode.attachedAnchors.set(resolvedAnchor.id, resolvedAnchor);
      }
    }
    if (payload.orientation) {
      resolvedAnchor.orientation = payload.orientation;
    }
    if ("graphemeIndex" in payload) {
      resolvedAnchor.graphemeIndex = payload.graphemeIndex;
    }
    if ("name" in payload) {
      resolvedAnchor.name = payload.name;
    }

    this.eventEmitters.anchorUpdated.emit(resolvedAnchor);
    if (resolvedAnchor.relatedInteractor) {
      this.eventEmitters.interactorUpdated.emit(resolvedAnchor.relatedInteractor);
    }
  }

  public updateInteractor(interactor: InteractorId | ReadonlyInteractor, payload: Partial<InteractorPayload>): void {
    const resolvedInteractor = this.interactorLookup.get(typeof interactor === "string" ? interactor : interactor.id);
    if (!resolvedInteractor) {
      throw new WorkingDocumentError("Unknown interactor");
    }

    if (payload.mainAnchor) {
      this.updateAnchor(resolvedInteractor.mainAnchor, payload.mainAnchor);
    }
    if ("selectionAnchor" in payload) {
      if (payload.selectionAnchor) {
        if (resolvedInteractor.selectionAnchor) {
          this.updateAnchor(resolvedInteractor.selectionAnchor, payload.selectionAnchor);
        } else {
          const selectionAnchor = this.addAnchor(
            payload.name ? { ...payload.selectionAnchor, name: payload.name + "-SELECTION" } : payload.selectionAnchor
          ) as WorkingAnchor;
          resolvedInteractor.selectionAnchor = selectionAnchor;
          selectionAnchor.relatedInteractor = resolvedInteractor;
        }
      } else {
        if (resolvedInteractor.selectionAnchor) {
          this.deleteAnchorPrime(resolvedInteractor.selectionAnchor, true);
          resolvedInteractor.selectionAnchor = undefined;
        }
      }
    }
    if ("lineMovementHorizontalVisualPosition" in payload) {
      resolvedInteractor.lineMovementHorizontalVisualPosition = payload.lineMovementHorizontalVisualPosition;
    }
    if ("name" in payload) {
      if (payload.name !== undefined) {
        resolvedInteractor.name = payload.name;
        resolvedInteractor.mainAnchor.name = payload.name + "-MAIN";
        if (resolvedInteractor.selectionAnchor) {
          resolvedInteractor.selectionAnchor.name = payload.name + "-SELECTION";
        }
      } else {
        resolvedInteractor.name = undefined;
        resolvedInteractor.mainAnchor.name = undefined;
        if (resolvedInteractor.selectionAnchor) {
          resolvedInteractor.selectionAnchor.name = undefined;
        }
      }
    }
    if (payload.status) {
      resolvedInteractor.status = payload.status;
    }

    this.eventEmitters.interactorUpdated.emit(resolvedInteractor);
  }

  private deleteAnchorPrime(anchor: ReadonlyWorkingAnchor | AnchorId, bypassInteractorCheck?: boolean): void {
    const id = typeof anchor === "string" ? anchor : anchor.id;
    const resolvedAnchor = this.anchorLookup.get(id);
    if (!resolvedAnchor) {
      throw new WorkingDocumentError("Could not find anchor");
    }
    if (resolvedAnchor.relatedInteractor && !bypassInteractorCheck) {
      throw new WorkingDocumentError("Cannot delete anchor without deleting related interactor");
    }
    this.anchorLookup.delete(id);
    resolvedAnchor.node.attachedAnchors.delete(id);

    this.eventEmitters.anchorDeleted.emit(resolvedAnchor);
  }
}
