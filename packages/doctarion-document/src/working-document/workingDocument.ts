import { FriendlyIdGenerator } from "doctarion-utils";
import lodash from "lodash";

import {
  AnchorOrientation,
  Document,
  DocumentNode,
  FacetDictionary,
  FacetTypeConvenienceDictionary,
  FacetValueType,
  Node,
  NodeChildrenType,
  NodeType,
  NodeTypeDescription,
  Span,
} from "../document-model";
import { FlowDirection } from "../miscUtils";
import { FancyGrapheme, FancyText, Grapheme, Text, TextStyle, TextStyleModifier, TextStyleStrip } from "../text-model";
import {
  CursorNavigator,
  CursorOrientation,
  CursorPath,
  NodeNavigator,
  Path,
  PathPart,
  PathString,
  PseudoNode,
  Range,
} from "../traversal";

import {
  AnchorId,
  AnchorParameters,
  ReadonlyWorkingAnchor,
  WorkingAnchor,
  WorkingAnchorRange,
  WorkingAnchorType,
} from "./anchor";
import {
  AnchorUpdateAssistantForNodeDeletion,
  AnchorUpdateAssistantForNodeJoin,
  AnchorUpdateAssistantHost,
  ContiguousOrderedInternalDocumentLocationArray,
} from "./anchorUpdateAssistants";
import { WorkingDocumentError } from "./error";
import { WorkingDocumentEventEmitter, WorkingDocumentEvents } from "./events";
import { InteractorId, InteractorParameters, ReadonlyWorkingInteractor, WorkingInteractor } from "./interactor";
import { cloneWorkingNodeAsEmptyRegularNode, createWorkingNode, createWorkingTextStyleStrip } from "./nodeCreation";
import {
  NodeId,
  ReadonlyWorkingDocumentNode,
  ReadonlyWorkingNode,
  WorkingDocumentNode,
  WorkingNode,
  WorkingNodeOfType,
} from "./nodes";
import { WorkingTextStyleStrip } from "./textStyleStrip";
import { Utils } from "./utils";

export enum InsertOrJoin {
  Insert = "INSERT",
  Join = "JOIN",
}

export interface InsertNodeResult {
  readonly workingNode: ReadonlyWorkingNode;
  readonly insertionHandledBy: InsertOrJoin;
}

export enum AnchorPullDirection {
  Backward = "BACKWARD",
  Forward = "FORWARD",
}

export interface ReadonlyWorkingDocument {
  readonly anchors: ReadonlyMap<AnchorId, ReadonlyWorkingAnchor>;
  readonly document: ReadonlyWorkingDocumentNode;
  readonly focusedInteractor: ReadonlyWorkingInteractor | undefined;
  readonly interactors: ReadonlyMap<InteractorId, ReadonlyWorkingInteractor>;
  readonly nodes: ReadonlyMap<NodeId, ReadonlyWorkingNode>;

  getAnchorParametersFromCursorNavigator(cursorNavigator: CursorNavigator): AnchorParameters;
  getAnchorParametersFromCursorPath(cursorPath: CursorPath): AnchorParameters;
  getCursorNavigatorForAnchor(anchor: ReadonlyWorkingAnchor | AnchorId): CursorNavigator<ReadonlyWorkingNode>;
  getCursorNavigatorsForInteractor(
    interactor: ReadonlyWorkingInteractor | InteractorId
  ): {
    readonly mainAnchor: CursorNavigator<ReadonlyWorkingNode>;
    readonly selectionAnchor: CursorNavigator<ReadonlyWorkingNode> | undefined;
  };
  getCursorPathForAnchor(anchor: ReadonlyWorkingAnchor | AnchorId): CursorPath;
  getCursorPathsForInteractor(
    anchor: ReadonlyWorkingInteractor | InteractorId
  ): { readonly mainAnchor: CursorPath; readonly selectionAnchor: CursorPath | undefined };
  getNodeAtPath(path: Path | PathString): ReadonlyWorkingNode;
  getNodeNavigator(node: NodeId | ReadonlyWorkingNode): NodeNavigator<ReadonlyWorkingNode>;
  getNodePath(node: NodeId | ReadonlyWorkingNode): Path;
  getNodeOrGraphemeAtPath(path: Path | PathString): PseudoNode<ReadonlyWorkingNode>;
}

export class WorkingDocument implements ReadonlyWorkingDocument {
  private readonly actualDocument: WorkingDocumentNode;
  private readonly anchorLookup: Map<AnchorId, WorkingAnchor>;
  private readonly anchorUpdateAssistantHost: AnchorUpdateAssistantHost;
  private readonly eventEmitters: WorkingDocumentEventEmitter;
  private focusedInteractorId: InteractorId | undefined;
  private readonly interactorLookup: Map<InteractorId, WorkingInteractor>;
  private readonly nodeLookup: Map<NodeId, WorkingNode>;

  /**
   * @param document  Note that the Document will merge adjacent Spans automatically.
   * @param idGenerator
   */
  public constructor(
    document: DocumentNode,
    private readonly idGenerator: FriendlyIdGenerator = new FriendlyIdGenerator()
  ) {
    this.anchorLookup = new Map<AnchorId, WorkingAnchor>();
    this.eventEmitters = new WorkingDocumentEventEmitter();
    this.interactorLookup = new Map<InteractorId, WorkingInteractor>();

    const { root, newNodes, newAnchors } = createWorkingNode(this.idGenerator, document, undefined, {
      joinAdjacentSpans: true,
    });
    if (!(root instanceof WorkingNode) || root.nodeType !== Document) {
      throw new WorkingDocumentError("Unexpected could not convert a Document node to its WorkingNode equivalent");
    }
    this.actualDocument = root;
    this.anchorLookup = newAnchors;
    this.nodeLookup = newNodes;

    this.anchorUpdateAssistantHost = {
      getAnchorParametersFromCursorNavigator: this.getAnchorParametersFromCursorNavigator.bind(this),
      getCursorNavigatorForAnchor: this.getCursorNavigatorForAnchor.bind(this),
      getNodeNavigator: this.getNodeNavigator.bind(this),

      addTransientAnchor: (parameters: AnchorParameters): WorkingAnchor => {
        return this.addAnchorPrime({ ...parameters, type: WorkingAnchorType.Transient });
      },
      deleteAnchor: (anchor: ReadonlyWorkingAnchor) => {
        this.deleteAnchorPrime(anchor, { bypassOriginatingNodeCheck: true });
      },
      updateAnchor: this.updateAnchor.bind(this),
    };
  }

  public get anchors(): ReadonlyMap<AnchorId, ReadonlyWorkingAnchor> {
    return this.anchorLookup;
  }
  public get document(): ReadonlyWorkingDocumentNode {
    return this.actualDocument;
  }
  public get events(): WorkingDocumentEvents {
    return this.eventEmitters;
  }
  public get focusedInteractor(): ReadonlyWorkingInteractor | undefined {
    return this.focusedInteractorId !== undefined ? this.interactors.get(this.focusedInteractorId) : undefined;
  }
  public get interactors(): ReadonlyMap<InteractorId, ReadonlyWorkingInteractor> {
    return this.interactorLookup;
  }
  public get nodes(): ReadonlyMap<NodeId, ReadonlyWorkingNode> {
    return this.nodeLookup;
  }

  public addAnchor(parameters: AnchorParameters): ReadonlyWorkingAnchor {
    return this.addAnchorPrime({ ...parameters, type: WorkingAnchorType.Free });
  }

  public addInteractor(parameters: InteractorParameters): ReadonlyWorkingInteractor {
    const id = this.idGenerator.generateId("INTERACTOR");

    const mainAnchor = this.addAnchorPrime(
      {
        ...parameters.mainAnchor,
        name: parameters.name ? parameters.name + "-MAIN" : undefined,
        type: WorkingAnchorType.Interactor,
      },
      { dontEmitAddedEvent: true }
    );
    const selectionAnchor = parameters.selectionAnchor
      ? this.addAnchorPrime(
          {
            ...parameters.selectionAnchor,
            name: parameters.name ? parameters.name + "-SELECTION" : undefined,
            type: WorkingAnchorType.Interactor,
          },
          { dontEmitAddedEvent: true }
        )
      : undefined;

    const newInteractor = new WorkingInteractor(
      id,
      mainAnchor,
      parameters.status,
      selectionAnchor,
      parameters.lineMovementHorizontalVisualPosition,
      parameters.name
    );
    this.interactorLookup.set(id, newInteractor);
    mainAnchor.relatedInteractor = newInteractor;
    if (selectionAnchor) {
      selectionAnchor.relatedInteractor = newInteractor;
    }

    this.eventEmitters.interactorAdded.emit(newInteractor);
    this.eventEmitters.anchorAdded.emit(mainAnchor);
    selectionAnchor && this.eventEmitters.anchorAdded.emit(selectionAnchor);

    return newInteractor;
  }

  public changeNodeType<SpecificNodeTypeDescription extends NodeTypeDescription = NodeTypeDescription>(
    node: NodeId | ReadonlyWorkingNode,
    nodeType: NodeType<SpecificNodeTypeDescription>,
    newFacets: SpecificNodeTypeDescription["facets"] extends FacetTypeConvenienceDictionary
      ? FacetDictionary<SpecificNodeTypeDescription["facets"]>
      : // eslint-disable-next-line @typescript-eslint/ban-types
        {}
  ): void {
    const resolvedNode = this.nodeLookup.get(typeof node === "string" ? node : node.id);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Unknown node");
    }
    const currentNodeType = resolvedNode.nodeType;
    // We dont support changing node types that change the category
    if (currentNodeType.category !== nodeType.category) {
      throw new WorkingDocumentError(
        `Cannot change node's type to be a new type with a different category (from: ${currentNodeType.category} to: ${nodeType.category})`
      );
    }
    // We dont support changing node types that have incompatible children types
    if (currentNodeType.childrenType !== nodeType.childrenType) {
      throw new WorkingDocumentError(
        `Cannot change node's type to be a new type with a different children type (from: ${currentNodeType.childrenType} to: ${nodeType.childrenType})`
      );
    }

    // Currently we dont delete facets or anchors like we should so we just
    // prohibit those types of conversion
    if (resolvedNode.getAllFacetAnchors().length > 0) {
      throw new WorkingDocumentError("Cannot change node's type when it has facets that are Anchors");
    }
    if (resolvedNode.getAllFacetNodes().length > 0) {
      throw new WorkingDocumentError("Cannot change node's type when it has facets that are Nodes");
    }

    // Reusing node creation logic even though we are going to ignore the root
    // node...
    const { root: rootToIgnore, newNodes, newAnchors } = createWorkingNode(
      this.idGenerator,
      new Node(nodeType, [], newFacets),
      this.nodeLookup,
      { joinAdjacentSpans: true }
    );

    for (const node of newNodes.values()) {
      this.nodeLookup.set(node.id, node);
      if (node.parent === rootToIgnore) {
        node.parent = resolvedNode;
      }
    }
    for (const anchor of newAnchors.values()) {
      // I don't think this is possible, but JIC
      if (anchor.node === rootToIgnore) {
        throw new WorkingDocumentError("Unexpectedly found anchor pointing to root when that should be impossible");
      }
      this.anchorLookup.set(anchor.id, anchor);
      this.eventEmitters.anchorAdded.emit(anchor);
    }

    // Do change
    resolvedNode.nodeType = nodeType;
    resolvedNode.facets = rootToIgnore.facets;

    if (nodeType === Span) {
      this.joinSpanToAdjacentSiblingsAndRemoveItIfPossible(resolvedNode);
    }
  }

  public deleteAnchor(anchor: ReadonlyWorkingAnchor | AnchorId): void {
    this.deleteAnchorPrime(anchor);
  }

  public deleteAtPath(path: PathString | Path, pull?: AnchorPullDirection): void {
    const nav = new NodeNavigator<ReadonlyWorkingNode>(this.actualDocument);
    if (nav.navigateTo(path)) {
      if (nav.tip.node instanceof Node) {
        this.deleteDocumentLocationsPrime([{ node: nav.tip.node as WorkingNode }], pull, true);
      } else if (nav.parent && PseudoNode.isGrapheme(nav.tip.node)) {
        this.deleteDocumentLocationsPrime(
          [{ node: nav.parent.node as WorkingNode, graphemeIndex: nav.tip.pathPart!.index }],
          pull,
          true
        );
      }
    } else {
      throw new WorkingDocumentError("Invalid path");
    }
  }

  public deleteInteractor(interactor: InteractorId | ReadonlyWorkingInteractor): void {
    const resolvedInteractor = this.interactorLookup.get(typeof interactor === "string" ? interactor : interactor.id);
    if (!resolvedInteractor) {
      throw new WorkingDocumentError("Unknown interactor");
    }
    this.deleteAnchorPrime(resolvedInteractor.mainAnchor, { bypassInteractorCheck: true });
    if (resolvedInteractor.selectionAnchor) {
      this.deleteAnchorPrime(resolvedInteractor.selectionAnchor, { bypassInteractorCheck: true });
    }
    this.interactorLookup.delete(resolvedInteractor.id);
    this.eventEmitters.interactorDeleted.emit(resolvedInteractor);
    if (this.focusedInteractorId === resolvedInteractor.id) {
      this.focusedInteractorId = undefined;
    }
  }

  public deleteNode(node: NodeId | ReadonlyWorkingNode, pull?: AnchorPullDirection): void {
    const resolvedNode = this.nodeLookup.get(typeof node === "string" ? node : node.id);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Unknown node");
    }
    this.deleteDocumentLocationsPrime([{ node: resolvedNode }], pull, true);
  }

  /**
   * This deletes a Grapheme (or FancyGrapheme) from a node.
   */
  public deleteNodeGrapheme(
    node: NodeId | ReadonlyWorkingNode,
    graphemeIndex: number,
    pull?: AnchorPullDirection
  ): void {
    const resolvedNode = this.nodeLookup.get(typeof node === "string" ? node : node.id);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Unknown node");
    }
    this.deleteDocumentLocationsPrime([{ node: resolvedNode, graphemeIndex }], pull, true);
  }

  public deleteRange(range: Range, pull?: AnchorPullDirection): void {
    const chainsToDelete = range.getChainsCoveringRange(this.actualDocument);
    if (chainsToDelete.length === 0) {
      return;
    }

    const fromNav = new NodeNavigator(this.actualDocument);
    const toNav = new NodeNavigator(this.actualDocument);
    if (!fromNav.navigateTo(range.from) || !toNav.navigateTo(range.to)) {
      throw new WorkingDocumentError("Range seems invalid");
    }

    // This is probably a very inefficient way to deal with text.. and everything
    this.deleteDocumentLocationsPrime(
      chainsToDelete.map((chain) =>
        chain.tip.node instanceof Node
          ? { node: chain.tip.node as WorkingNode }
          : { node: chain.parent!.node as WorkingNode, graphemeIndex: chain.tip.pathPart!.index }
      ),
      pull,
      true
    );
  }

  public getAnchorParametersFromCursorNavigator(cursorNavigator: CursorNavigator): AnchorParameters {
    const node = cursorNavigator.tip.node;
    if (PseudoNode.isGrapheme(node)) {
      const parent = cursorNavigator.parent?.node;
      if (!parent) {
        throw new WorkingDocumentError("Grapheme lacks parent");
      }
      return {
        node: parent as WorkingNode,
        orientation: (cursorNavigator.cursor.orientation as unknown) as AnchorOrientation,
        graphemeIndex: cursorNavigator.tip.pathPart!.index,
      };
    }
    return {
      node: node as WorkingNode,
      orientation: (cursorNavigator.cursor.orientation as unknown) as AnchorOrientation,
      graphemeIndex: undefined,
    };
  }

  public getAnchorParametersFromCursorPath(cursorPath: CursorPath): AnchorParameters {
    const n = new CursorNavigator(this.actualDocument);
    if (!n.navigateFreelyTo(cursorPath)) {
      throw new WorkingDocumentError("Could not create valid CursorNavigator for CursorPath");
    }
    return this.getAnchorParametersFromCursorNavigator(n);
  }

  public getCursorNavigatorForAnchor(anchor: ReadonlyWorkingAnchor | AnchorId): CursorNavigator<WorkingNode> {
    const cursorPath = this.getCursorPathForAnchor(anchor);
    const n = new CursorNavigator(this.actualDocument);
    if (n.navigateFreelyTo(cursorPath)) {
      return n;
    }
    throw new WorkingDocumentError("Could not create valid CursorNavigator for anchor");
  }

  public getCursorNavigatorsForInteractor(
    interactor: ReadonlyWorkingInteractor | InteractorId
  ): {
    readonly mainAnchor: CursorNavigator<WorkingNode>;
    readonly selectionAnchor: CursorNavigator<WorkingNode> | undefined;
  } {
    const resolvedInteractor = this.interactorLookup.get(typeof interactor === "string" ? interactor : interactor.id);
    if (!resolvedInteractor) {
      throw new WorkingDocumentError("Unknown interactor");
    }
    return {
      mainAnchor: this.getCursorNavigatorForAnchor(resolvedInteractor.mainAnchor),
      selectionAnchor: resolvedInteractor.selectionAnchor
        ? this.getCursorNavigatorForAnchor(resolvedInteractor.selectionAnchor)
        : undefined,
    };
  }

  public getCursorPathForAnchor(anchor: ReadonlyWorkingAnchor | AnchorId): CursorPath {
    const resolvedAnchor = this.anchorLookup.get(typeof anchor === "string" ? anchor : anchor.id);
    if (!resolvedAnchor) {
      throw new WorkingDocumentError("Unknown anchor");
    }

    const path = this.getNodePath(resolvedAnchor.node);
    if (resolvedAnchor.graphemeIndex !== undefined) {
      // Normalize
      let { graphemeIndex, orientation } = resolvedAnchor;
      if (orientation === AnchorOrientation.Before) {
        const nodeKids = resolvedAnchor.node.children;
        if (nodeKids && graphemeIndex !== 0) {
          graphemeIndex--;
          orientation = AnchorOrientation.After;
        }
      }

      return new CursorPath(
        new Path(...path.parts, new PathPart(graphemeIndex)),
        (orientation as unknown) as CursorOrientation
      );
    }
    return new CursorPath(path, (resolvedAnchor.orientation as unknown) as CursorOrientation);
  }

  public getCursorPathsForInteractor(
    interactor: ReadonlyWorkingInteractor | InteractorId
  ): { readonly mainAnchor: CursorPath; readonly selectionAnchor: CursorPath | undefined } {
    const resolvedInteractor = this.interactorLookup.get(typeof interactor === "string" ? interactor : interactor.id);
    if (!resolvedInteractor) {
      throw new WorkingDocumentError("Unknown interactor");
    }
    return {
      mainAnchor: this.getCursorPathForAnchor(resolvedInteractor.mainAnchor),
      selectionAnchor: resolvedInteractor.selectionAnchor
        ? this.getCursorPathForAnchor(resolvedInteractor.selectionAnchor)
        : undefined,
    };
  }

  public getNodeAtPath(path: Path | PathString): ReadonlyWorkingNode {
    const nav = new NodeNavigator<ReadonlyWorkingNode>(this.actualDocument);
    if (!nav.navigateTo(path)) {
      throw new WorkingDocumentError("Invalid path");
    }
    if (!PseudoNode.isNode(nav.tip.node)) {
      throw new WorkingDocumentError("Path points to a Grapheme");
    }
    return nav.tip.node;
  }

  public getNodeNavigator(node: NodeId | ReadonlyWorkingNode): NodeNavigator<WorkingNode> {
    const path = this.getNodePath(node);
    const nav = new NodeNavigator<WorkingNode>(this.actualDocument);
    if (!nav.navigateTo(path)) {
      throw new WorkingDocumentError("Invalid node path");
    }
    return nav;
  }

  public getNodeOrGraphemeAtPath(path: Path | PathString): PseudoNode<ReadonlyWorkingNode> {
    const nav = new NodeNavigator<ReadonlyWorkingNode>(this.actualDocument);
    if (!nav.navigateTo(path)) {
      throw new WorkingDocumentError("Invalid path");
    }
    return nav.tip.node;
  }

  public getNodePath(node: NodeId | ReadonlyWorkingNode): Path {
    const resolvedNode = this.nodeLookup.get(typeof node === "string" ? node : node.id);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Unknown node");
    }
    return Utils.getNodePath(resolvedNode);
  }

  /**
   * Note in the case of Spans, this may result in an existing Span being
   * updated (and returned) rather than a new Span actually being created.
   */
  public insertNode(parent: NodeId | ReadonlyWorkingNode, node: Node, index: number, facet?: string): InsertNodeResult {
    return this.insertNodePrime(parent, node, index, facet, true);
  }

  public insertNodeGrapheme(
    node: ReadonlyWorkingNode,
    grapheme: FancyGrapheme | Grapheme,
    index: number,
    facet?: string
  ): void {
    this.insertNodeText(node, [grapheme], index, facet);
  }

  public insertNodeText(node: ReadonlyWorkingNode, text: FancyText | Text, index: number, facet?: string): void {
    const resolvedNode = this.nodeLookup.get(typeof node === "string" ? node : node.id);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Unknown node");
    }
    const resolvedFacet = facet !== undefined ? resolvedNode.nodeType.facets?.[facet] : undefined;
    if (facet && !resolvedFacet) {
      throw new WorkingDocumentError("Unknown facet");
    }

    const isFancy = Utils.isFancyText(text);

    if (resolvedFacet === undefined) {
      if (isFancy && resolvedNode.nodeType.childrenType !== NodeChildrenType.FancyText) {
        throw new WorkingDocumentError("Node cannot have fancy grapheme children");
      } else if (!isFancy && Utils.doesNodeTypeHaveTextOrFancyText(resolvedNode.nodeType)) {
        throw new WorkingDocumentError("Node cannot have grapheme children");
      }
    } else if (resolvedFacet && (resolvedFacet.valueType !== FacetValueType.String || isFancy)) {
      throw new WorkingDocumentError("Node cannot have text or fancy text in the given facet");
    }

    if (resolvedFacet) {
      const facetValue = resolvedNode.getFacet(facet!);
      if (!facetValue) {
        resolvedNode.setFacet(facet!, text);
      } else {
        (facetValue as Grapheme[]).splice(index, 0, ...(text as Grapheme[]));
      }
    } else {
      resolvedNode.children.splice(index, 0, ...text);
    }

    for (const [, strip] of resolvedNode.getAllFacetTextStyleStrips()) {
      (strip as WorkingTextStyleStrip).updateDueToGraphemeInsertion(index, text.length);
    }

    for (const [, anchor] of resolvedNode.attachedAnchors) {
      if (anchor.graphemeIndex !== undefined && anchor.graphemeIndex >= index) {
        // This arguably makes this class know a little too much about valid
        // cursor positions
        if (anchor.orientation !== AnchorOrientation.Before) {
          this.updateAnchor(anchor, { graphemeIndex: anchor.graphemeIndex + text.length });
        } else {
          if (text.length === 1) {
            this.updateAnchor(anchor, { orientation: AnchorOrientation.After });
          } else {
            this.updateAnchor(anchor, {
              orientation: AnchorOrientation.After,
              graphemeIndex: anchor.graphemeIndex + text.length - 1,
            });
          }
        }
      }
    }
  }

  public joinSiblingIntoNode(node: NodeId | ReadonlyWorkingNode, direction: FlowDirection): void {
    const resolvedNode = this.nodeLookup.get(typeof node === "string" ? node : node.id);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Unknown node");
    }
    const dest = resolvedNode;
    const nav = Utils.getNodeNavigator(this.actualDocument, this.getNodePath(resolvedNode));
    const destNav = nav.clone();

    if (!(direction === FlowDirection.Backward ? nav.navigateToPrecedingSibling() : nav.navigateToNextSibling())) {
      throw new WorkingDocumentError("Could not find sibling node to join to");
    }

    const source = nav.tip.node as WorkingNode;

    if (dest.nodeType !== source.nodeType) {
      throw new WorkingDocumentError("Cannot join nodes of different types");
    }

    const otherNodesToJoinAsFollowUps: WorkingNode[] = [];

    if (Utils.doesNodeTypeHaveNodeChildren(dest.nodeType)) {
      // Move children from one inline to the next
      const { boundaryChildIndex } = this.moveAllNodesAndUpdateAnchors(
        source,
        dest,
        undefined,
        direction === FlowDirection.Backward
      );
      if (boundaryChildIndex !== undefined && boundaryChildIndex > 0) {
        const beforeBoundaryNode = dest.children[boundaryChildIndex - 1] as WorkingNode;
        const atBoundaryNode = dest.children[boundaryChildIndex] as WorkingNode;

        // Special handling for spans, merge them
        if (beforeBoundaryNode.nodeType === Span && atBoundaryNode.nodeType === Span) {
          otherNodesToJoinAsFollowUps.push(beforeBoundaryNode);
        }
      }
    } else if (Utils.doesNodeTypeHaveTextOrFancyText(dest.nodeType)) {
      this.moveAllGraphemesAndUpdateAnchors(source, dest, direction === FlowDirection.Backward);
    }

    for (const { name: facetName } of dest.nodeType.getFacetsThatAreNodeArrays()) {
      const { boundaryChildIndex } = this.moveAllNodesAndUpdateAnchors(
        source,
        dest,
        facetName,
        direction === FlowDirection.Forward
      );

      // Again, special handling for spans
      if (boundaryChildIndex !== undefined && boundaryChildIndex > 0) {
        const beforeBoundaryNode = (dest.getFacet(facetName) as any)?.[boundaryChildIndex - 1] as WorkingNode;
        const atBoundaryNode = (dest.getFacet(facetName) as any)?.[boundaryChildIndex] as WorkingNode;

        // Special handling for spans, merge them
        if (beforeBoundaryNode.nodeType === Span && atBoundaryNode.nodeType === Span) {
          otherNodesToJoinAsFollowUps.push(beforeBoundaryNode);
          // this.joinSiblingIntoNode(beforeBoundaryNode, PullDirection.Forward);
        }
      }
    }

    this.eventEmitters.nodesJoined.emit({ destination: destNav, source: nav });

    this.deleteDocumentLocationsPrime(
      [{ node: source }],
      direction === FlowDirection.Backward ? AnchorPullDirection.Backward : AnchorPullDirection.Forward,
      false // I think its logically impossible for us to have to join spans during this delete and the source is empty at this point... I think
    );

    for (const node of otherNodesToJoinAsFollowUps) {
      this.joinSiblingIntoNode(node, FlowDirection.Forward);
    }
  }

  public setFocusedInteractor(id: InteractorId | undefined): void {
    if (id !== undefined) {
      if (this.interactors.get(id) === undefined) {
        throw new WorkingDocumentError("Invalid interactor id");
      }
    }
    this.focusedInteractorId = id;
  }

  public setNodeFacet(
    node: NodeId | ReadonlyWorkingNode,
    facet: string,
    value: boolean | string | AnchorParameters | [AnchorParameters, AnchorParameters] | readonly Node[]
  ): void {
    const resolvedNode = this.nodeLookup.get(typeof node === "string" ? node : node.id);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Unknown node");
    }
    const resolvedFacet = resolvedNode.nodeType.facets?.[facet];
    if (!resolvedFacet) {
      throw new WorkingDocumentError("Unknown facet");
    }
    const valueType = typeof value;
    switch (resolvedFacet.valueType) {
      case FacetValueType.Boolean:
        if (valueType === "boolean" || (valueType === "undefined" && resolvedFacet.optional)) {
          resolvedNode.setFacet(facet, value);
        } else {
          throw new WorkingDocumentError(`Can not set facet ${facet} to value of type ${valueType}`);
        }
        break;
      case FacetValueType.EntityId:
        if (valueType === "string" || (valueType === "undefined" && resolvedFacet.optional)) {
          resolvedNode.setFacet(facet, value);
        } else {
          throw new WorkingDocumentError(`Can not set facet ${facet} to value of type ${valueType}`);
        }
        break;
      case FacetValueType.String:
        if (typeof value === "string" || (valueType === "undefined" && resolvedFacet.optional)) {
          resolvedNode.setFacet(facet, value);
        } else {
          throw new WorkingDocumentError(`Can not set facet ${facet} to value of type ${valueType}`);
        }
        break;
      case FacetValueType.Enum:
        if (valueType === "string") {
          if (resolvedFacet.options!.includes(value as string)) {
            resolvedNode.setFacet(facet, value);
          } else {
            throw new WorkingDocumentError(`Can not set facet ${facet} to value ${value as string}`);
          }
        } else if (valueType === "undefined" && resolvedFacet.optional) {
          resolvedNode.setFacet(facet, value);
        } else {
          throw new WorkingDocumentError(`Can not set facet ${facet} to value of type ${valueType}`);
        }
        break;
      case FacetValueType.TextStyleStrip:
        if (value instanceof TextStyleStrip) {
          resolvedNode.setFacet(facet, createWorkingTextStyleStrip(value));
        } else if (valueType === "undefined" && resolvedFacet.optional) {
          resolvedNode.setFacet(facet, value);
        } else {
          throw new WorkingDocumentError(`Can not set facet ${facet} to value of type ${valueType}`);
        }
        break;
      case FacetValueType.Anchor:
      case FacetValueType.AnchorRange:
      case FacetValueType.AnchorOrAnchorRange:
        {
          let convertedValue: WorkingAnchor | WorkingAnchorRange | undefined;
          if (Utils.isAnchorParameters(value)) {
            if (resolvedFacet.valueType === FacetValueType.AnchorRange) {
              throw new WorkingDocumentError(`Can not set facet ${facet} to passed value`);
            }
            convertedValue = this.addAnchorPrime(
              { ...value, type: WorkingAnchorType.Node },
              { dontEmitAddedEvent: true }
            );
            convertedValue.relatedOriginatingNode = resolvedNode;
          } else if (Utils.isAnchorParametersPair(value)) {
            if (resolvedFacet.valueType === FacetValueType.Anchor) {
              throw new WorkingDocumentError(`Can not set facet ${facet} to passed value`);
            }
            const from = this.addAnchorPrime(
              { ...value[0], type: WorkingAnchorType.Node },
              { dontEmitAddedEvent: true }
            );
            const to = this.addAnchorPrime({ ...value[1], type: WorkingAnchorType.Node }, { dontEmitAddedEvent: true });
            from.relatedOriginatingNode = resolvedNode;
            to.relatedOriginatingNode = resolvedNode;
            convertedValue = new WorkingAnchorRange(from, to);
          } else if (valueType === "undefined" && resolvedFacet.optional) {
            // Do nothing here actually
          } else {
            throw new WorkingDocumentError(`Can not set facet ${facet} to value of type ${valueType}`);
          }

          const currentValue = resolvedNode.getFacet(facet);
          if (currentValue instanceof WorkingAnchor) {
            this.deleteAnchor(currentValue);
          } else if (currentValue instanceof WorkingAnchorRange) {
            this.deleteAnchor(currentValue.from);
            this.deleteAnchor(currentValue.to);
          } else if (currentValue !== undefined) {
            throw new WorkingDocumentError(`Current facet ${facet} value was not an anchor`);
          }

          resolvedNode.setFacet(facet, convertedValue);

          if (convertedValue instanceof WorkingAnchor) {
            this.eventEmitters.anchorAdded.emit(convertedValue);
          } else if (convertedValue instanceof WorkingAnchorRange) {
            this.eventEmitters.anchorAdded.emit(convertedValue.from);
            this.eventEmitters.anchorAdded.emit(convertedValue.to);
          }
        }
        break;
      case FacetValueType.NodeArray:
        {
          const currentValue = resolvedNode.getFacet(facet);

          if (
            currentValue !== undefined &&
            !(Array.isArray(currentValue) && currentValue.every((e) => e instanceof WorkingNode))
          ) {
            throw new WorkingDocumentError(`Current facet ${facet} value is not a node array`);
          }
          if (value === undefined) {
            if (!resolvedFacet.optional) {
              throw new WorkingDocumentError(`Cannot set facet ${facet} to passed value`);
            }
          } else {
            if (!Array.isArray(value) || value.find((e) => !(e instanceof Node) || e instanceof WorkingNode)) {
              throw new WorkingDocumentError(`Cannot set facet ${facet} to passed value`);
            }
          }

          currentValue?.map((node: WorkingNode) =>
            this.deleteDocumentLocationsPrime(
              [{ node }],
              AnchorPullDirection.Backward,
              false // There is no need to join Spans here
            )
          );

          if (value) {
            resolvedNode.setFacet(facet, []);
            for (let i = 0; i < value.length; i++) {
              this.insertNode(resolvedNode, (value[i] as unknown) as Node, i, facet);
            }
          } else {
            resolvedNode.setFacet(facet, undefined);
          }
        }
        break;
    }
  }

  public setNodeTextStyleModifier(
    node: NodeId | ReadonlyWorkingNode,
    facet: string,
    modifier: TextStyleModifier,
    graphemeIndex: number
  ): void {
    const resolvedNode = this.nodeLookup.get(typeof node === "string" ? node : node.id);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Unknown node");
    }
    const resolvedFacet = resolvedNode.nodeType.facets?.[facet];
    if (!resolvedFacet) {
      throw new WorkingDocumentError("Unknown facet");
    }
    const value = resolvedNode.getFacet(facet);
    if (value instanceof WorkingTextStyleStrip) {
      value.setModifier(graphemeIndex, modifier);
    } else {
      throw new WorkingDocumentError("Facet value is not a text style strip");
    }
  }

  /**
   * Note that this will not split Spans because they would be auto joined back
   * together. You may want to use splitNodeAndInsert for inserting nodes in a
   * span.
   */
  public splitAtPath(path: PathString | Path, splitChildIndices: readonly number[]): void {
    const node = this.getNodeOrGraphemeAtPath(path);
    if (!PseudoNode.isNode(node)) {
      throw new WorkingDocumentError("Cannot split on a Grapheme");
    }
    this.splitNodePrime(node as WorkingNode, splitChildIndices, true);
  }

  /**
   * Note that this will not split Spans because they would be auto joined back
   * together. You may want to use splitNodeAndInsert for inserting nodes in a
   * span.
   */
  public splitNode(node: NodeId | ReadonlyWorkingNode, splitChildIndices: readonly number[]): void {
    const resolvedNode = this.nodeLookup.get(typeof node === "string" ? node : node.id);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Unknown node");
    }
    this.splitNodePrime(resolvedNode, splitChildIndices, true);
  }

  /**
   * This is especially handy when you want to split a Span and insert another
   * node at the split. This is otherwise not possible because the normal
   * splitNode won't split Spans.
   */
  public splitNodeAndInsertBetween(
    nodeToSplit: NodeId | ReadonlyWorkingNode,
    splitChildIndices: readonly number[],
    nodeToInsert: Node
  ): InsertNodeResult {
    const resolvedNodeToSplit = this.nodeLookup.get(typeof nodeToSplit === "string" ? nodeToSplit : nodeToSplit.id);
    if (!resolvedNodeToSplit) {
      throw new WorkingDocumentError("Unknown node");
    }
    const parent = resolvedNodeToSplit.parent;
    const splitNodeIndexFromParent = resolvedNodeToSplit.pathPartFromParent?.index;
    if (
      !parent ||
      splitNodeIndexFromParent === undefined ||
      resolvedNodeToSplit.pathPartFromParent?.facet !== undefined
    ) {
      throw new WorkingDocumentError("Node to split doesn't have parent or cannot determine child index");
    }
    this.splitNodePrime(resolvedNodeToSplit, splitChildIndices, false);
    return this.insertNodePrime(parent, nodeToInsert, splitNodeIndexFromParent + 1, undefined, true);
  }

  public updateAnchor(anchor: AnchorId | ReadonlyWorkingAnchor, parameters: Partial<AnchorParameters>): void {
    const resolvedAnchor = this.anchorLookup.get(typeof anchor === "string" ? anchor : anchor.id);
    if (!resolvedAnchor) {
      throw new WorkingDocumentError("Unknown anchor");
    }

    if (parameters.node) {
      const oldNode = resolvedAnchor.node;
      const nodeId = typeof parameters.node === "string" ? parameters.node : parameters.node.id;
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
    if (parameters.orientation) {
      resolvedAnchor.orientation = parameters.orientation;
    }
    if ("graphemeIndex" in parameters) {
      resolvedAnchor.graphemeIndex = parameters.graphemeIndex;
    }
    if ("name" in parameters) {
      resolvedAnchor.name = parameters.name;
    }

    if (resolvedAnchor.type !== WorkingAnchorType.Transient) {
      this.eventEmitters.anchorUpdated.emit(resolvedAnchor);
      if (resolvedAnchor.relatedInteractor) {
        this.eventEmitters.interactorUpdated.emit(resolvedAnchor.relatedInteractor);
      }
    }
  }

  public updateInteractor(
    interactor: InteractorId | ReadonlyWorkingInteractor,
    parameters: Partial<InteractorParameters>
  ): void {
    const resolvedInteractor = this.interactorLookup.get(typeof interactor === "string" ? interactor : interactor.id);
    if (!resolvedInteractor) {
      throw new WorkingDocumentError("Unknown interactor");
    }

    if (parameters.mainAnchor) {
      this.updateAnchor(resolvedInteractor.mainAnchor, parameters.mainAnchor);
    }
    if ("selectionAnchor" in parameters) {
      if (parameters.selectionAnchor) {
        if (resolvedInteractor.selectionAnchor) {
          this.updateAnchor(resolvedInteractor.selectionAnchor, parameters.selectionAnchor);
        } else {
          const selectionAnchor = this.addAnchorPrime({
            ...parameters.selectionAnchor,
            type: WorkingAnchorType.Interactor,
            name: parameters.name
              ? parameters.name + "-SELECTION"
              : resolvedInteractor?.name
              ? resolvedInteractor.name + "-SELECTION"
              : undefined,
          });
          resolvedInteractor.selectionAnchor = selectionAnchor;
          selectionAnchor.relatedInteractor = resolvedInteractor;
        }
      } else {
        if (resolvedInteractor.selectionAnchor) {
          this.deleteAnchorPrime(resolvedInteractor.selectionAnchor, { bypassInteractorCheck: true });
          resolvedInteractor.selectionAnchor = undefined;
        }
      }
    }
    if ("lineMovementHorizontalVisualPosition" in parameters) {
      resolvedInteractor.lineMovementHorizontalVisualPosition = parameters.lineMovementHorizontalVisualPosition;
    }
    if ("name" in parameters) {
      if (parameters.name !== undefined) {
        resolvedInteractor.name = parameters.name;
        resolvedInteractor.mainAnchor.name = parameters.name + "-MAIN";
        if (resolvedInteractor.selectionAnchor) {
          resolvedInteractor.selectionAnchor.name = parameters.name + "-SELECTION";
        }
      } else {
        resolvedInteractor.name = undefined;
        resolvedInteractor.mainAnchor.name = undefined;
        if (resolvedInteractor.selectionAnchor) {
          resolvedInteractor.selectionAnchor.name = undefined;
        }
      }
    }
    if (parameters.status) {
      resolvedInteractor.status = parameters.status;
    }

    this.eventEmitters.interactorUpdated.emit(resolvedInteractor);
  }

  private addAnchorPrime(
    parameters: AnchorParameters & { type: WorkingAnchorType },
    options?: { dontEmitAddedEvent?: boolean }
  ): WorkingAnchor {
    const { node, orientation, graphemeIndex, name, type } = parameters;
    const nodeId = typeof node === "string" ? node : node.id;
    const resolvedNode = this.nodeLookup.get(nodeId);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Node could not be found in document");
    }
    const anchorId = this.idGenerator.generateId("ANCHOR");
    const anchor = new WorkingAnchor(
      anchorId,
      resolvedNode,
      orientation,
      graphemeIndex,
      type,
      name,
      undefined,
      undefined
    );
    this.anchorLookup.set(anchorId, anchor);
    resolvedNode.attachedAnchors.set(anchorId, anchor);

    if (!options?.dontEmitAddedEvent && anchor.type !== WorkingAnchorType.Transient) {
      this.eventEmitters.anchorAdded.emit(anchor);
    }

    return anchor;
  }

  private deleteAnchorPrime(
    anchor: ReadonlyWorkingAnchor | AnchorId,
    options?: {
      bypassInteractorCheck?: boolean;
      bypassOriginatingNodeCheck?: boolean;
    }
  ): void {
    const id = typeof anchor === "string" ? anchor : anchor.id;
    const resolvedAnchor = this.anchorLookup.get(id);
    if (!resolvedAnchor) {
      throw new WorkingDocumentError("Could not find anchor");
    }
    if (resolvedAnchor.relatedInteractor && !options?.bypassInteractorCheck) {
      throw new WorkingDocumentError("Cannot delete anchor without deleting related interactor");
    }
    if (resolvedAnchor.relatedOriginatingNode && !options?.bypassOriginatingNodeCheck) {
      throw new WorkingDocumentError("Cannot delete anchor that originates from a node");
    }
    this.anchorLookup.delete(id);
    resolvedAnchor.node.attachedAnchors.delete(id);

    if (resolvedAnchor.type !== WorkingAnchorType.Transient) {
      this.eventEmitters.anchorDeleted.emit(resolvedAnchor);
    }
  }

  /**
   * @param contiguousOrderedLocationArray These have to be adjacent contiguous
   * locations for this logic to work in all cases. These probably should be in
   * reverse order too.
   */
  private deleteDocumentLocationsPrime(
    contiguousOrderedLocationArray: ContiguousOrderedInternalDocumentLocationArray,
    pull: AnchorPullDirection | undefined,
    joinAdjacentSpansIfPossible: boolean
  ): void {
    if (contiguousOrderedLocationArray.length < 1) {
      return;
    }

    const joinAdjacentSpansCandidates: {
      leftNode: WorkingNodeOfType<typeof Span>;
      rightNode: WorkingNodeOfType<typeof Span>;
    }[] = [];

    const assistant = new AnchorUpdateAssistantForNodeDeletion(
      this.anchorUpdateAssistantHost,
      contiguousOrderedLocationArray,
      pull === AnchorPullDirection.Forward ? FlowDirection.Forward : FlowDirection.Backward,
      joinAdjacentSpansIfPossible
    );

    try {
      for (const { node, graphemeIndex } of lodash.reverse(contiguousOrderedLocationArray)) {
        if (!this.nodeLookup.has(node.id)) {
          continue;
        }

        if (graphemeIndex === undefined) {
          const isDocument = this.actualDocument === node;
          // Update parent to remove node
          !isDocument && this.removeNodeFromParent(node);
          // Delete the node and all its descendant nodes...
          // Note traverseNodeSubTree also yields the passed in node for convenience
          for (const descendantNode of Utils.traverseNodeSubTree(node)) {
            if (!this.nodeLookup.has(descendantNode.id) || descendantNode === this.actualDocument) {
              continue;
            }
            this.nodeLookup.delete(descendantNode.id);
            assistant.recordAnchorsOriginatingFromAndPointingToNode(descendantNode);
          }
          if (isDocument) {
            node.children = [];
          }

          // Special logic to merge Spans
          if (
            joinAdjacentSpansIfPossible &&
            node.parent &&
            node.parent.nodeType.childrenType === NodeChildrenType.Inlines &&
            node.pathPartFromParent &&
            !node.pathPartFromParent.facet &&
            node.pathPartFromParent.index !== undefined &&
            node.pathPartFromParent.index > 0 &&
            node.pathPartFromParent.index < node.parent.children.length
          ) {
            const i = node.pathPartFromParent.index;
            const leftNode = node.parent.children[i - 1] as WorkingNodeOfType<typeof Span>;
            const rightNode = node.parent.children[i] as WorkingNodeOfType<typeof Span>;
            if (leftNode.nodeType === Span && rightNode.nodeType === Span) {
              joinAdjacentSpansCandidates.push({ leftNode, rightNode });
            }
          }
        } else {
          if (!Utils.doesNodeTypeHaveTextOrFancyText(node.nodeType)) {
            throw new WorkingDocumentError("Node unexpectedly does not have grapheme children");
          }
          node.children.splice(graphemeIndex, 1);

          assistant.recordOrUpdateAnchorsOriginatingFromNodeGrapheme(node, graphemeIndex);

          for (const [, strip] of node.getAllFacetTextStyleStrips()) {
            (strip as WorkingTextStyleStrip).updateDueToGraphemeDeletion(graphemeIndex, 1);
          }
        }
      }

      assistant.commitUpdatesAndDeletion();
    } finally {
      assistant.cleanUp();
    }

    // Join any Spans that might be join-able now
    for (const { leftNode, rightNode } of joinAdjacentSpansCandidates) {
      // Make sure both nodes still exist...
      if (this.nodeLookup.has(leftNode.id) && this.nodeLookup.has(rightNode.id)) {
        // And join
        this.joinSiblingIntoNode(leftNode, FlowDirection.Forward);
      }
    }
  }

  private insertNodePrime(
    parent: NodeId | ReadonlyWorkingNode,
    node: Node,
    index: number,
    facet: string | undefined,
    joinNodeToAdjacentSpansIfPossible: boolean
  ): InsertNodeResult {
    const resolvedParentNode = this.nodeLookup.get(typeof parent === "string" ? parent : parent.id);
    if (!resolvedParentNode) {
      throw new WorkingDocumentError("Unknown parent");
    }
    const resolvedFacet = facet !== undefined ? resolvedParentNode.nodeType.facets?.[facet] : undefined;
    if (facet && !resolvedFacet) {
      throw new WorkingDocumentError("Unknown facet");
    }
    if (index < 0) {
      throw new WorkingDocumentError("Insertion index must be non-negative");
    }

    // Make sure the parent can contains nodes
    if (
      resolvedFacet === undefined &&
      !Utils.canNodeTypeContainChildrenOfType(resolvedParentNode.nodeType, node.nodeType)
    ) {
      throw new WorkingDocumentError("Parent cannot have children of the given type");
    } else if (resolvedFacet && !Utils.canFacetContainNodesOfType(resolvedFacet, node.nodeType)) {
      throw new WorkingDocumentError("Parent cannot have nodes of the given type in the given facet");
    }

    const { root: workingNode, newNodes, newAnchors } = createWorkingNode(this.idGenerator, node, this.nodeLookup, {
      joinAdjacentSpans: true,
    });

    if (resolvedFacet) {
      const facetValue = resolvedParentNode.getFacet(facet!);
      if (!facetValue) {
        resolvedParentNode.setFacet(facet!, [workingNode]);
      } else {
        const facetNodeArray = facetValue as WorkingNode[];
        if (index > facetNodeArray.length) {
          throw new WorkingDocumentError(`Insertion index ${index} is larger than the limit ${facetNodeArray.length}`);
        }
        facetNodeArray.splice(index, 0, workingNode);
      }
    } else {
      if (index > resolvedParentNode.children.length) {
        throw new WorkingDocumentError(
          `Insertion index ${index} is larger than the limit ${resolvedParentNode.children.length}`
        );
      }
      resolvedParentNode.children.splice(index, 0, workingNode);
    }

    for (const node of newNodes.values()) {
      this.nodeLookup.set(node.id, node);
    }
    for (const anchor of newAnchors.values()) {
      this.anchorLookup.set(anchor.id, anchor);
      this.eventEmitters.anchorAdded.emit(anchor);
    }

    Utils.updateNodeChildrenToHaveCorrectParentAndPathPartFromParent(resolvedParentNode, facet, index);

    // Special case handling for Spans that are adjacent to other spans... this
    // could probably be handled in such a way as to avoid the insertion and
    // logic above but this is less code.
    if (joinNodeToAdjacentSpansIfPossible) {
      const joinedNode = this.joinSpanToAdjacentSiblingsAndRemoveItIfPossible(workingNode);
      if (joinedNode) {
        return { workingNode: joinedNode, insertionHandledBy: InsertOrJoin.Join };
      }
    }

    return { workingNode: workingNode, insertionHandledBy: InsertOrJoin.Insert };
  }

  private joinSpanToAdjacentSiblingsAndRemoveItIfPossible(node: WorkingNode): WorkingNode | undefined {
    if (
      node.nodeType !== Span ||
      node.parent === undefined ||
      node.pathPartFromParent === undefined ||
      node.pathPartFromParent.facet !== undefined ||
      node.pathPartFromParent.index === undefined
    ) {
      return undefined;
    }
    const parent = node.parent;
    const index = node.pathPartFromParent?.index;

    if ((parent.children[index + 1] as Node)?.nodeType === Span) {
      const other = parent.children[index + 1] as WorkingNodeOfType<typeof Span>;
      this.joinSiblingIntoNode(other, FlowDirection.Backward);

      // Check other direction now
      if ((parent.children[index - 1] as Node)?.nodeType === Span) {
        const otherOther = parent.children[index - 1] as WorkingNodeOfType<typeof Span>;
        this.joinSiblingIntoNode(otherOther, FlowDirection.Forward);
        return otherOther;
      } else {
        return other;
      }
    }
    if ((parent.children[index - 1] as Node)?.nodeType === Span) {
      const other = parent.children[index - 1] as WorkingNodeOfType<typeof Span>;
      this.joinSiblingIntoNode(other, FlowDirection.Forward);
      return other;
    }
    return undefined;
  }

  private moveAllGraphemesAndUpdateAnchors(source: WorkingNode, destination: WorkingNode, prepend: boolean) {
    const destArray = destination.children as Grapheme[];
    const sourceArray = source.children as Grapheme[];
    const destArrayOriginalLength = destArray.length;
    const sourceArrayOriginalLength = sourceArray.length;

    for (const child of prepend ? lodash.reverse(sourceArray) : sourceArray) {
      prepend ? destArray.unshift(child) : destArray.push(child);
    }

    AnchorUpdateAssistantForNodeJoin.performUpdateForNodeWithGraphemeChildren(
      this.anchorUpdateAssistantHost,
      source,
      destination,
      prepend ? FlowDirection.Backward : FlowDirection.Forward,
      sourceArrayOriginalLength,
      destArrayOriginalLength
    );

    // Update text style strips if they exist
    for (const { name: facetName } of destination.nodeType.getFacetsThatAreTextStyleStrips()) {
      let destStrip = destination.getFacet(facetName) as WorkingTextStyleStrip | undefined;
      const sourceStrip = source.getFacet(facetName) as WorkingTextStyleStrip | undefined;

      if (!destStrip && !sourceStrip) {
        continue;
      }
      if (!destStrip) {
        destStrip = new WorkingTextStyleStrip([]);
        destination.setFacet(facetName, destStrip);
      }

      if (prepend) {
        destStrip.updateForPrepend(sourceArrayOriginalLength, sourceStrip ?? new WorkingTextStyleStrip([]));
      } else {
        destStrip.updateForAppend(destArrayOriginalLength, sourceStrip ?? new WorkingTextStyleStrip([]));
      }

      if (sourceArrayOriginalLength > 0 && destArrayOriginalLength > 0) {
        const boundaryIndex = prepend ? sourceArrayOriginalLength : destArrayOriginalLength;
        const resolvedStyle = destStrip.resolveStyleAt(boundaryIndex - 1);
        const modifierAtBoundary = destStrip.getModifierAtExactly(boundaryIndex);
        const revertStyleModifier = TextStyle.createModifierToResetStyleToDefaults(resolvedStyle);

        destStrip.setModifier(boundaryIndex, { ...revertStyleModifier, ...modifierAtBoundary });
      }
    }

    for (const [, strip] of source.getAllFacetTextStyleStrips()) {
      (strip as WorkingTextStyleStrip).clear();
    }

    sourceArray.splice(0, sourceArrayOriginalLength);
  }

  private moveAllNodesAndUpdateAnchors(
    source: WorkingNode,
    destination: WorkingNode,
    facet: string | undefined, // undefined meaning "children"
    prepend: boolean
  ): { boundaryChildIndex: number | undefined } {
    const destArray = facet ? (destination.getFacet(facet) as WorkingNode[]) : (destination.children as WorkingNode[]);
    const sourceArray = facet ? (source.getFacet(facet) as WorkingNode[]) : (source.children as WorkingNode[]);
    const destArrayOriginalLength = destArray.length;
    const sourceArrayOriginalLength = sourceArray.length;

    for (const child of prepend ? lodash.reverse(sourceArray) : sourceArray) {
      if (prepend) {
        destArray.unshift(child);
      } else {
        destArray.push(child);
        child.pathPartFromParent = child.pathPartFromParent?.adjustIndex(destArrayOriginalLength);
      }
      child.parent = destination;
    }

    if (prepend) {
      for (let k = sourceArrayOriginalLength; k < destArray.length; k++) {
        destArray[k].pathPartFromParent = destArray[k].pathPartFromParent?.adjustIndex(sourceArrayOriginalLength);
      }
    }

    // This moves anchors over to the destination in a logical way
    AnchorUpdateAssistantForNodeJoin.performUpdateForNodeWithNodeChildren(
      this.anchorUpdateAssistantHost,
      source,
      destination,
      prepend ? FlowDirection.Backward : FlowDirection.Forward,
      sourceArrayOriginalLength,
      destArrayOriginalLength
    );

    sourceArray.splice(0, sourceArrayOriginalLength);

    return {
      boundaryChildIndex:
        sourceArrayOriginalLength === 0 || destArrayOriginalLength === 0
          ? undefined
          : prepend
          ? sourceArrayOriginalLength
          : destArrayOriginalLength,
    };
  }

  private removeNodeFromParent(node: WorkingNode) {
    const parent = node.parent;
    if (parent) {
      if (!parent.children) {
        throw new WorkingDocumentError("Node parent missing children unexpectedly");
      }
      const pathPart = node.pathPartFromParent;
      if (!pathPart) {
        throw new WorkingDocumentError("Could not find pathPartFromParent on node");
      }
      if (pathPart.facet) {
        if (pathPart.index === undefined) {
          // This is easy
          (parent as any)[pathPart.facet] = undefined;
        } else {
          const array = (parent as any)[pathPart.facet];
          if (array && Array.isArray(array)) {
            array.splice(pathPart.index, 1);
            for (let i = pathPart.index; i < array.length; i++) {
              const kid = array[i];
              const kidPathPart = (kid as WorkingNode).pathPartFromParent;
              if (kidPathPart !== undefined) {
                (kid as WorkingNode).pathPartFromParent = kidPathPart.adjustIndex(-1);
              }
            }
          }
        }
      } else {
        if (pathPart.index === undefined) {
          throw new WorkingDocumentError("Node pathPartFromParent missing index and facet");
        }
        parent.children.splice(pathPart.index, 1);
        for (let i = pathPart.index; i < parent.children.length; i++) {
          const kid = parent.children[i];
          const kidPathPart = (kid as WorkingNode).pathPartFromParent;
          if (kidPathPart !== undefined) {
            (kid as WorkingNode).pathPartFromParent = kidPathPart.adjustIndex(-1);
          }
        }
      }
    } else {
      // This must be the document, so don't really do anything
      throw new WorkingDocumentError("Cannot remove document from parent, as there is no parent");
    }
  }

  private splitNodePrime(
    node: WorkingNode,
    splitChildIndices: readonly number[],
    preventSplitThatCreatesAdjacentSpans: boolean
  ): void {
    if (node.nodeType === Document) {
      throw new WorkingDocumentError("Cannot split the Document");
    }
    if (!node.parent || node.pathPartFromParent?.index === undefined) {
      throw new WorkingDocumentError("Unknown node parent");
    }

    if (splitChildIndices.length === 0) {
      throw new WorkingDocumentError("Cannot split a node without specifying which child to split at");
    }

    // Make sure we can split nodes
    const nav = Utils.getNodeNavigator(this.actualDocument, this.getNodePath(node));
    for (let i = 0; i < splitChildIndices.length; i++) {
      const childIndex = splitChildIndices[i];
      if (!nav.navigateToChild(childIndex)) {
        if (i === splitChildIndices.length - 1) {
          // If we are at the end, its OK to be exactly one past the last child index
          if (childIndex === (nav.tip.node as Node)?.children?.length) {
            // This is ok
            break;
          }
        }
        throw new WorkingDocumentError("Could not find target");
      }
      if (i < splitChildIndices.length - 1) {
        if (!PseudoNode.isNode(nav.tip.node)) {
          throw new WorkingDocumentError("Node cannot be split");
        }
        if (!Utils.canNodeBeSplit(nav.tip.node)) {
          throw new WorkingDocumentError("Node cannot be split");
        }
      } else {
        if (PseudoNode.isGrapheme(nav.tip.node)) {
          if (childIndex === 0 && splitChildIndices.length === 1) {
            // This is a no-op (no point in splitting something with text as
            // children at the first character). There is no content on one
            // side!
            return;
          } else if (childIndex === 0) {
            // In this case, the split could have some other impact so we try
            // again just without the last index
            this.splitNode(node, splitChildIndices.slice(0, childIndex - 1));
            return;
          }
        }
      }
    }

    if (!Utils.canNodeBeSplit(node)) {
      throw new WorkingDocumentError("Node cannot be split");
    }

    if (preventSplitThatCreatesAdjacentSpans && node.nodeType === Span) {
      // Don't split (JUST) a single Span because we'd just auto merge them (normally)
      return;
    }

    const clone: Node = cloneWorkingNodeAsEmptyRegularNode(node);
    const newWorkingRoot = this.insertNodePrime(
      node.parent,
      clone,
      node.pathPartFromParent.index + 1,
      undefined,
      preventSplitThatCreatesAdjacentSpans
    ).workingNode as WorkingNode;

    let currentSplitSource: WorkingNode = node;
    let currentSplitDest = newWorkingRoot;
    for (let i = 0; i < splitChildIndices.length; i++) {
      const childIndex = splitChildIndices[i];

      const isLastSplit = i === splitChildIndices.length - 1;

      const splitOutKids = currentSplitSource.children.splice(
        childIndex,
        currentSplitSource.children.length - childIndex
      ) as any[];
      currentSplitDest.children = [...splitOutKids, ...currentSplitDest.children] as any;

      if (Utils.doesNodeTypeHaveNodeChildren(currentSplitSource.nodeType)) {
        if (isLastSplit) {
          Utils.updateNodeChildrenToHaveCorrectParentAndPathPartFromParent(currentSplitDest);
        } else {
          // Split the kids of the CURRENT SPLIT SOURCE, after the BOUNDARY child
          // node (which will become the current split source and be modified in
          // the next loop)...
          const boundaryNodeThatWeAreGoingToSplitMore = currentSplitDest.children[0] as WorkingNode;

          const boundaryNodeToAddToDest = cloneWorkingNodeAsEmptyRegularNode(boundaryNodeThatWeAreGoingToSplitMore);
          // Return the boundary node original to the parent and put the spilt version in the destination
          (currentSplitSource.children as any[]).push(boundaryNodeThatWeAreGoingToSplitMore as any);
          currentSplitDest.children.shift(); // We will insert the new node it below

          Utils.updateNodeChildrenToHaveCorrectParentAndPathPartFromParent(currentSplitDest);

          // Finally insert the new boundary node and set it for the next iteration
          currentSplitDest = this.insertNodePrime(currentSplitDest, boundaryNodeToAddToDest, 0, undefined, true)
            .workingNode as WorkingNode;
          currentSplitSource = boundaryNodeThatWeAreGoingToSplitMore;
        }
      } else {
        if (!isLastSplit) {
          throw new WorkingDocumentError("Unexpectedly tried to split graphemes");
        }

        // In this case (graphemes) we may need to move anchors that are on
        // the graphemes... and split the TextStyleStrips
        for (const anchor of currentSplitSource.attachedAnchors.values()) {
          if (anchor.graphemeIndex !== undefined && anchor.graphemeIndex >= childIndex) {
            this.updateAnchor(anchor, {
              node: currentSplitDest,
              graphemeIndex: anchor.graphemeIndex - childIndex,
            });
          }
        }

        for (const [{ name: facetName }, strip] of currentSplitSource.getAllFacetTextStyleStrips()) {
          const newStrip: WorkingTextStyleStrip = (strip as WorkingTextStyleStrip).updateAndSplitAt(childIndex);
          currentSplitDest.setFacet(facetName, newStrip);
        }
      }
    }
  }
}
