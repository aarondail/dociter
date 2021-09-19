import { FriendlyIdGenerator } from "doctarion-utils";

import { Document } from "../document-model-rd4";

import { AnchorId, WorkingAnchor } from "./anchor";
import { createWorkingDocumentRootNode } from "./createWorkingDocumentRootNode";
import { WorkingDocumentEventEmitter, WorkingDocumentEvents } from "./events";
import { Interactor, InteractorId } from "./interactor";
import { NodeId, ReadonlyWorkingDocumentRootNode, WorkingDocumentRootNode, WorkingNode } from "./nodes";

export interface ReadonlyWorkingDocument {
  readonly document: ReadonlyWorkingDocumentRootNode;

  // getAllAnchors(): readonly Anchor[];
  // getAllInteractors(): readonly Interactor[];
  // getAnchor(anchorId: AnchorId): Anchor | undefined;
  // getInteractorAnchor(id: InteractorId | Interactor, anchorType: InteractorAnchorType): Anchor | undefined;
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
  private readonly interactors: Map<InteractorId, Interactor>;
  private readonly nodeLookup: Map<NodeId, WorkingNode>;

  public constructor(
    document: Document,
    private readonly idGenerator: FriendlyIdGenerator = new FriendlyIdGenerator()
  ) {
    this.anchorLookup = new Map<AnchorId, WorkingAnchor>();
    this.eventEmitters = new WorkingDocumentEventEmitter();
    this.interactors = new Map<InteractorId, Interactor>();
    this.nodeLookup = new Map<NodeId, WorkingNode>();

    this.actualDocument = createWorkingDocumentRootNode(this.idGenerator, document);

    // Assign initial node ids
    // const n = new NodeNavigator(this.document);
    // n.navigateToStartOfDfs();
    // // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // this.processNodeCreated(this.document as any, undefined);
    // n.traverseDescendants((node, parent) => this.processNodeCreated(node as immer.Draft<ObjectNode>, parent), {
    //   skipGraphemes: true,
    // });
  }

  public get document(): ReadonlyWorkingDocumentRootNode {
    return this.actualDocument;
  }
  public get events(): WorkingDocumentEvents {
    return this.eventEmitters;
  }
}
