import { FriendlyIdGenerator } from "doctarion-utils";

import { NodeNavigator, Path, PseudoNodeUtils, Range } from "../basic-traversal-rd4";
import { Document, Facet, FacetType, Node } from "../document-model-rd4";
import { FancyGrapheme, FancyText, Grapheme, Text, TextStyleStrip } from "../text-model-rd4";

import { AnchorId, AnchorPayload, ReadonlyWorkingAnchor, WorkingAnchor, WorkingAnchorRange } from "./anchor";
import { createWorkingNode, createWorkingTextStyleStrip } from "./conversion";
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
import { WorkingTextStyleStrip } from "./textStyleStrip";
import { Utils } from "./utils";

export interface ReadonlyWorkingDocument {
  readonly allAnchors: ReadonlyMap<AnchorId, ReadonlyWorkingAnchor>;
  readonly document: ReadonlyWorkingDocumentRootNode;
  readonly interactors: ReadonlyMap<InteractorId, ReadonlyInteractor>;
  readonly nodes: ReadonlyMap<NodeId, ReadonlyWorkingNode>;
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

    const { root, newNodes, newAnchors } = createWorkingNode(this.idGenerator, document);
    if (!(root instanceof WorkingDocumentRootNode)) {
      throw new WorkingDocumentError("Unexpected could not convert a Document node to its WorkingNode equivalent");
    }
    this.actualDocument = root;
    this.anchorLookup = newAnchors;
    this.nodeLookup = newNodes;
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
    return this.addAnchorPrime(payload);
  }

  public addInteractor(payload: InteractorPayload & Partial<Pick<InteractorPayload, "status">>): ReadonlyInteractor {
    const id = this.idGenerator.generateId("INTERACTOR");

    const mainAnchor = this.addAnchorPrime(
      payload.name ? { ...payload.mainAnchor, name: payload.name + "-MAIN" } : payload.mainAnchor,
      "dont-emit-event"
    );
    const selectionAnchor = payload.selectionAnchor
      ? this.addAnchorPrime(
          payload.name ? { ...payload.selectionAnchor, name: payload.name + "-SELECTION" } : payload.selectionAnchor,
          "dont-emit-event"
        )
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
    this.eventEmitters.anchorAdded.emit(mainAnchor);
    selectionAnchor && this.eventEmitters.anchorAdded.emit(selectionAnchor);

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
    this.deleteAnchorPrime(resolvedInteractor.mainAnchor, "bypass-interactor-check");
    if (resolvedInteractor.selectionAnchor) {
      this.deleteAnchorPrime(resolvedInteractor.selectionAnchor, "bypass-interactor-check");
    }
    this.interactorLookup.delete(resolvedInteractor.id);
    this.eventEmitters.interactorDeleted.emit(resolvedInteractor);
  }

  public deleteNode(node: NodeId | ReadonlyWorkingNode /*, additionalContext?: NodeEditAdditionalContext*/): void {
    const resolvedNode = this.nodeLookup.get(typeof node === "string" ? node : node.id);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Unknown node");
    }
    this.deleteNodesAndGraphemesPrime([{ node: resolvedNode }]);
  }

  public deleteNodeAtPath(path: Path /*, additionalContext?: NodeEditAdditionalContext*/): void {
    const nav = new NodeNavigator(this.actualDocument);
    if (nav.navigateTo(path)) {
      if (nav.tip.node instanceof Node) {
        this.deleteNodesAndGraphemesPrime([{ node: nav.tip.node as WorkingNode }]);
      } else if (nav.parent && PseudoNodeUtils.isGrapheme(nav.tip.node)) {
        this.deleteNodesAndGraphemesPrime([
          { node: nav.parent.node as WorkingNode, graphemeIndex: nav.tip.pathPart.index },
        ]);
      }
    }
  }

  /**
   * This deletes a Grapheme (or FancyGrapheme) from a node.
   */
  public deleteNodeGrapheme(
    node: NodeId | ReadonlyWorkingNode,
    graphemeIndex: number
    /*, additionalContext?: NodeEditAdditionalContext*/
  ): void {
    const resolvedNode = this.nodeLookup.get(typeof node === "string" ? node : node.id);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Unknown node");
    }
    this.deleteNodesAndGraphemesPrime([{ node: resolvedNode, graphemeIndex }]);
  }

  public deleteNodesInRange(range: Range /*additionalContext?: NodeEditAdditionalContext*/): void {
    const chainsToDelete = range.getChainsCoveringRange(this.document);
    if (chainsToDelete.length === 0) {
      return;
    }

    const fromNav = new NodeNavigator(this.actualDocument);
    const toNav = new NodeNavigator(this.actualDocument);
    if (!fromNav.navigateTo(range.from) || !toNav.navigateTo(range.to)) {
      throw new WorkingDocumentError("Range seems invalid");
    }

    chainsToDelete.reverse();

    // This is probably a very inefficient way to deal with text.. and everything
    for (const chain of chainsToDelete) {
      if (chain.tip.node instanceof Node) {
        this.deleteNodesAndGraphemesPrime([{ node: chain.tip.node as WorkingNode }]);
      } else if (chain.parent && PseudoNodeUtils.isGrapheme(chain.tip.node)) {
        this.deleteNodesAndGraphemesPrime([
          { node: chain.parent.node as WorkingNode, graphemeIndex: chain.tip.pathPart.index },
        ]);
      }
    }
  }

  public insertNode(
    parent: NodeId | ReadonlyWorkingNode,
    node: Node,
    index: number,
    facet?: string | Facet
  ): ReadonlyWorkingNode {
    const resolvedParentNode = this.nodeLookup.get(typeof parent === "string" ? parent : parent.id);
    if (!resolvedParentNode) {
      throw new WorkingDocumentError("Unknown parent");
    }
    const resolvedFacet =
      facet !== undefined
        ? resolvedParentNode.nodeType.facets.get(typeof facet === "string" ? facet : facet.name)
        : undefined;
    if (facet && !resolvedFacet) {
      throw new WorkingDocumentError("Unknown facet");
    }

    // Make sure the parent can contains nodes
    if (resolvedFacet === undefined && !resolvedParentNode.nodeType.canContainChildrenOfType(node.nodeType)) {
      throw new WorkingDocumentError("Parent cannot have children of the given type");
    } else if (
      resolvedFacet &&
      (resolvedFacet.type !== FacetType.NodeArray || resolvedFacet.canContainNodesOfType(node.nodeType))
    ) {
      throw new WorkingDocumentError("Parent cannot have nodes of the given type in the given facet");
    }

    const { root: workingNode, newNodes, newAnchors } = createWorkingNode(this.idGenerator, node, this.nodeLookup);

    for (const node of newNodes.values()) {
      this.nodeLookup.set(node.id, node);
    }
    for (const anchor of newAnchors.values()) {
      this.anchorLookup.set(anchor.id, anchor);
      this.eventEmitters.anchorAdded.emit(anchor);
    }

    if (resolvedFacet) {
      const facetValue = resolvedParentNode.getFacetValue(resolvedFacet);
      if (!facetValue) {
        resolvedParentNode.setFacet(resolvedFacet, [workingNode]);
      } else {
        (facetValue as WorkingNode[]).splice(index, 0, workingNode);
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      resolvedParentNode.children!.splice(index, 0, workingNode);
    }

    return workingNode;
  }

  public insertNodeGrapheme(
    node: ReadonlyWorkingNode,
    grapheme: FancyGrapheme | Grapheme,
    index: number,
    facet?: string | Facet
  ): void {
    this.insertNodeText(node, [grapheme], index, facet);
  }

  public insertNodeText(
    node: ReadonlyWorkingNode,
    text: FancyText | Text,
    index: number,
    facet?: string | Facet
  ): void {
    const resolvedNode = this.nodeLookup.get(typeof node === "string" ? node : node.id);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Unknown node");
    }
    const resolvedFacet =
      facet !== undefined
        ? resolvedNode.nodeType.facets.get(typeof facet === "string" ? facet : facet.name)
        : undefined;
    if (facet && !resolvedFacet) {
      throw new WorkingDocumentError("Unknown facet");
    }

    const isFancy = Utils.isFancyText(text);

    if (resolvedFacet === undefined) {
      if (isFancy && !resolvedNode.nodeType.hasFancyGraphemeChildren()) {
        throw new WorkingDocumentError("Node cannot have fancy grapheme children");
      } else if (!isFancy && !resolvedNode.nodeType.hasGraphemeChildren()) {
        throw new WorkingDocumentError("Node cannot have grapheme children");
      }
    } else if (resolvedFacet && (resolvedFacet.type !== FacetType.Text || isFancy)) {
      throw new WorkingDocumentError("Node cannot have graphemes or fancy graphemes in the given facet");
    }

    if (resolvedFacet) {
      const facetValue = resolvedNode.getFacetValue(resolvedFacet);
      if (!facetValue) {
        resolvedNode.setFacet(resolvedFacet, text);
      } else {
        (facetValue as Grapheme[]).splice(index, 0, ...(text as Grapheme[]));
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      resolvedNode.children!.splice(index, 0, ...text);
    }

    for (const [, strip] of resolvedNode.getAllFacetTextStyleStrips()) {
      (strip as WorkingTextStyleStrip).updateDueToGraphemeInsertion(index, text.length);
    }

    for (const [, anchor] of resolvedNode.attachedAnchors) {
      if (anchor.graphemeIndex !== undefined && anchor.graphemeIndex >= index) {
        this.updateAnchor(anchor, {
          graphemeIndex: anchor.graphemeIndex + text.length,
        });
      }
    }
  }

  // public joinNodes() {
  // }

  // public setNodeTextStyle() {

  // }

  public setNodeFacet(
    node: NodeId | ReadonlyWorkingNode,
    facet: string | Facet,
    value: boolean | string | AnchorPayload | [AnchorPayload, AnchorPayload] | readonly Node[]
  ): void {
    const resolvedNode = this.nodeLookup.get(typeof node === "string" ? node : node.id);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Unknown node");
    }
    const resolvedFacet = resolvedNode.nodeType.facets.get(typeof facet === "string" ? facet : facet.name);
    if (!resolvedFacet) {
      throw new WorkingDocumentError("Unknown facet");
    }
    const valueType = typeof value;
    switch (resolvedFacet.type) {
      case FacetType.Boolean:
        if (valueType === "boolean" || (valueType === "undefined" && resolvedFacet.optional)) {
          resolvedNode.setFacet(resolvedFacet, value);
        } else {
          throw new WorkingDocumentError(`Can not set facet ${resolvedFacet.name} to value of type ${valueType}`);
        }
        break;
      case FacetType.EntityId:
        if (valueType === "string" || (valueType === "undefined" && resolvedFacet.optional)) {
          resolvedNode.setFacet(resolvedFacet, value);
        } else {
          throw new WorkingDocumentError(`Can not set facet ${resolvedFacet.name} to value of type ${valueType}`);
        }
        break;
      case FacetType.Text:
        if (Utils.isText(value) || (valueType === "undefined" && resolvedFacet.optional)) {
          resolvedNode.setFacet(resolvedFacet, value);
        } else {
          throw new WorkingDocumentError(`Can not set facet ${resolvedFacet.name} to value of type ${valueType}`);
        }
        break;
      case FacetType.Enum:
        if (valueType === "string") {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          if (resolvedFacet.options!.includes(value as string)) {
            resolvedNode.setFacet(resolvedFacet, value);
          } else {
            throw new WorkingDocumentError(`Can not set facet ${resolvedFacet.name} to value ${value as string}`);
          }
        } else if (valueType === "undefined" && resolvedFacet.optional) {
          resolvedNode.setFacet(resolvedFacet, value);
        } else {
          throw new WorkingDocumentError(`Can not set facet ${resolvedFacet.name} to value of type ${valueType}`);
        }
        break;
      case FacetType.TextStyleStrip:
        if (value instanceof TextStyleStrip) {
          resolvedNode.setFacet(resolvedFacet, createWorkingTextStyleStrip(value));
        } else if (valueType === "undefined" && resolvedFacet.optional) {
          resolvedNode.setFacet(resolvedFacet, value);
        } else {
          throw new WorkingDocumentError(`Can not set facet ${resolvedFacet.name} to value of type ${valueType}`);
        }
        break;
      case FacetType.Anchor:
      case FacetType.AnchorRange:
      case FacetType.AnchorOrAnchorRange:
        {
          let convertedValue: WorkingAnchor | WorkingAnchorRange | undefined;
          if (Utils.isAnchorPayload(value)) {
            if (resolvedFacet.type === FacetType.AnchorRange) {
              throw new WorkingDocumentError(`Can not set facet ${resolvedFacet.name} to passed value`);
            }
            convertedValue = this.addAnchorPrime(value, "dont-emit-event");
            convertedValue.relatedOriginatingNode = resolvedNode;
          } else if (Utils.isAnchorPayloadPair(value)) {
            if (resolvedFacet.type === FacetType.Anchor) {
              throw new WorkingDocumentError(`Can not set facet ${resolvedFacet.name} to passed value`);
            }
            const from = this.addAnchorPrime(value[0], "dont-emit-event");
            const to = this.addAnchorPrime(value[1], "dont-emit-event");
            from.relatedOriginatingNode = resolvedNode;
            to.relatedOriginatingNode = resolvedNode;
            convertedValue = new WorkingAnchorRange(from, to);
          } else if (valueType === "undefined" && resolvedFacet.optional) {
            // Do nothing here actually
          } else {
            throw new WorkingDocumentError(`Can not set facet ${resolvedFacet.name} to value of type ${valueType}`);
          }

          const currentValue = resolvedNode.getFacetValue(resolvedFacet);
          if (currentValue instanceof WorkingAnchor) {
            this.deleteAnchor(currentValue);
          } else if (currentValue instanceof WorkingAnchorRange) {
            this.deleteAnchor(currentValue.from);
            this.deleteAnchor(currentValue.to);
          } else if (currentValue !== undefined) {
            throw new WorkingDocumentError(`Current facet ${resolvedFacet.name} value was not an anchor`);
          }

          resolvedNode.setFacet(resolvedFacet, convertedValue);

          if (convertedValue instanceof WorkingAnchor) {
            this.eventEmitters.anchorAdded.emit(convertedValue);
          } else if (convertedValue instanceof WorkingAnchorRange) {
            this.eventEmitters.anchorAdded.emit(convertedValue.from);
            this.eventEmitters.anchorAdded.emit(convertedValue.to);
          }
        }
        break;
      case FacetType.NodeArray:
        {
          const currentValue = resolvedNode.getFacetValue(resolvedFacet);

          if (
            currentValue !== undefined &&
            !(Array.isArray(currentValue) && currentValue.every((e) => Utils.isWorkingNode(e)))
          ) {
            throw new WorkingDocumentError(`Current facet ${resolvedFacet.name} value is not a node array`);
          }
          if (value === undefined) {
            if (!resolvedFacet.optional) {
              throw new WorkingDocumentError(`Cannot set facet ${resolvedFacet.name} to passed value`);
            }
          } else {
            if (!Array.isArray(value) || value.find((e) => !(e instanceof Node) || Utils.isWorkingNode(e))) {
              throw new WorkingDocumentError(`Cannot set facet ${resolvedFacet.name} to passed value`);
            }
          }

          currentValue && this.deleteNodesAndGraphemesPrime(currentValue.map((node: WorkingNode) => ({ node })));

          if (value) {
            resolvedNode.setFacet(resolvedFacet, []);
            for (let i = 0; i < value.length; i++) {
              this.insertNode(resolvedNode, (value[i] as unknown) as Node, i, resolvedFacet);
            }
          } else {
            resolvedNode.setFacet(resolvedFacet, undefined);
          }
        }
        break;
    }
  }

  // public splitNode() {

  // }

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
          this.deleteAnchorPrime(resolvedInteractor.selectionAnchor, "bypass-interactor-check");
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

  private addAnchorPrime(payload: AnchorPayload, option?: "dont-emit-event"): WorkingAnchor {
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

    if (option !== "dont-emit-event") {
      this.eventEmitters.anchorAdded.emit(anchor);
    }

    return anchor;
  }

  private deleteAnchorPrime(
    anchor: ReadonlyWorkingAnchor | AnchorId,
    option?: "bypass-interactor-check" | "bypass-originating-node-check"
  ): void {
    const id = typeof anchor === "string" ? anchor : anchor.id;
    const resolvedAnchor = this.anchorLookup.get(id);
    if (!resolvedAnchor) {
      throw new WorkingDocumentError("Could not find anchor");
    }
    if (resolvedAnchor.relatedInteractor && !(option === "bypass-interactor-check")) {
      throw new WorkingDocumentError("Cannot delete anchor without deleting related interactor");
    }
    if (resolvedAnchor.relatedOriginatingNode && !(option === "bypass-originating-node-check")) {
      throw new WorkingDocumentError("Cannot delete anchor that originates from a node");
    }
    this.anchorLookup.delete(id);
    resolvedAnchor.node.attachedAnchors.delete(id);

    this.eventEmitters.anchorDeleted.emit(resolvedAnchor);
  }

  private deleteNodesAndGraphemesPrime(
    locations: readonly {
      readonly node: WorkingNode;
      readonly graphemeIndex?: number;
    }[]
    /*, additionalContext?: NodeEditAdditionalContext*/
  ): void {
    if (locations.length < 1) {
      return;
    }

    // This is needed in case we have orphaned anchors
    const deletionTarget = Utils.getNodeNavigatorForNode(locations[0].node, this.actualDocument);
    if (locations[0].graphemeIndex !== undefined) {
      deletionTarget.navigateToChild(locations[0].graphemeIndex);
    }

    const orphanedAnchors = new Set<WorkingAnchor>();
    const removedAnchors = new Set<WorkingAnchor>();

    for (const { node, graphemeIndex } of locations) {
      if (!this.nodeLookup.has(node.id)) {
        continue;
      }

      if (graphemeIndex === undefined) {
        this.removeNodeFromParent(node);
      } else {
        if (!node.children || !node.nodeType.hasGraphemeChildren()) {
          return;
        }
        node.children.splice(graphemeIndex, 1);
      }

      if (graphemeIndex === undefined) {
        // traverseNodeSubTree also yields the passed in node for convenience
        for (const descendantNode of Utils.traverseNodeSubTree(node)) {
          if (!this.nodeLookup.has(descendantNode.id)) {
            continue;
          }
          this.nodeLookup.delete(descendantNode.id);
          for (const [, anchor] of node.attachedAnchors) {
            orphanedAnchors.add(anchor);
          }
          for (const anchor of Utils.traverseAllAnchorsOriginatingFrom(node)) {
            removedAnchors.add(anchor);
          }
        }
      } else {
        for (const anchor of node.attachedAnchors.values()) {
          if (anchor.graphemeIndex !== undefined) {
            if (anchor.graphemeIndex === graphemeIndex) {
              orphanedAnchors.add(anchor);
            } else if (anchor.graphemeIndex > graphemeIndex) {
              anchor.graphemeIndex--;
            }
          }
        }

        for (const [, strip] of node.getAllFacetTextStyleStrips()) {
          (strip as WorkingTextStyleStrip).updateDueToGraphemeDeletion(graphemeIndex, 1);
        }
      }
    }

    for (const anchor of removedAnchors) {
      this.deleteAnchorPrime(anchor, "bypass-originating-node-check");
    }

    for (const anchor of orphanedAnchors) {
      if (removedAnchors.has(anchor)) {
        continue;
      }
      this.eventEmitters.anchorOrphaned.emit({ anchor, deletionTarget });
    }
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
          (parent as any)[pathPart.facet] = undefined;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
          const array = (parent as any)[pathPart.facet];
          if (array && Array.isArray(array)) {
            array.splice(pathPart.index, 1);
            for (let i = pathPart.index; i < array.length; i++) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
      // This must be the document, so don't really delete it
      throw new WorkingDocumentError("Cannot delete document root node");
    }
  }
}
