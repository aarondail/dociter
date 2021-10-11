import { FriendlyIdGenerator } from "doctarion-utils";
import lodash from "lodash";

import { NodeNavigator, Path, PseudoNode, Range } from "../basic-traversal-rd4";
import { Document, Facet, FacetType, Node, Span } from "../document-model-rd4";
import {
  FancyGrapheme,
  FancyText,
  Grapheme,
  Text,
  TextStyle,
  TextStyleModifier,
  TextStyleStrip,
} from "../text-model-rd4";

import { AnchorId, AnchorPayload, ReadonlyWorkingAnchor, WorkingAnchor, WorkingAnchorRange } from "./anchor";
import { WorkingDocumentError } from "./error";
import { WorkingDocumentEventEmitter, WorkingDocumentEvents } from "./events";
import { Interactor, InteractorId, InteractorPayload, ReadonlyInteractor } from "./interactor";
import { FlowDirection } from "./misc";
import { cloneWorkingNodeAsEmptyRegularNode, createWorkingNode, createWorkingTextStyleStrip } from "./nodeCreation";
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
      } else if (nav.parent && PseudoNode.isGrapheme(nav.tip.node)) {
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
      } else if (chain.parent && PseudoNode.isGrapheme(chain.tip.node)) {
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

  public joinSiblingIntoNode(node: NodeId | ReadonlyWorkingNode, direction: FlowDirection): void {
    const resolvedNode = this.nodeLookup.get(typeof node === "string" ? node : node.id);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Unknown node");
    }
    const nav = Utils.getNodeNavigatorForNode(resolvedNode, this.actualDocument);
    const destNav = nav.clone();

    if (!(direction === FlowDirection.Backward ? nav.navigateToPrecedingSibling() : nav.navigateToNextSibling())) {
      throw new WorkingDocumentError("Could not find sibling node to join to");
    }

    const dest = resolvedNode;
    const source = nav.tip.node as WorkingNode;

    if (dest.nodeType !== source.nodeType) {
      throw new WorkingDocumentError("Cannot join nodes of different types");
    }

    const toJoinFollowUps: WorkingNode[] = [];

    if (dest.nodeType.hasNodeChildren()) {
      // Move children from one inline to the next
      const { boundaryChildIndex } = this.moveAllNodes(source, dest, undefined, direction === FlowDirection.Forward);
      if (boundaryChildIndex !== undefined && boundaryChildIndex > 0) {
        const beforeBoundaryNode = dest.children![boundaryChildIndex - 1] as WorkingNode;
        const atBoundaryNode = dest.children![boundaryChildIndex] as WorkingNode;

        // Special handling for spans, merge them
        if (beforeBoundaryNode instanceof Span && atBoundaryNode instanceof Span) {
          toJoinFollowUps.push(beforeBoundaryNode);
          // this.joinSiblingIntoNode(beforeBoundaryNode, FlowDirection.Forward);
        }
      }
    } else if (dest.nodeType.hasGraphemeChildren() || dest.nodeType.hasFancyGraphemeChildren()) {
      this.moveAllNodeGraphemes(source, dest, direction === FlowDirection.Forward);
    }

    for (const facet of dest.nodeType.getFacetsThatAreNodeArrays()) {
      const { boundaryChildIndex } = this.moveAllNodes(source, dest, facet, direction === FlowDirection.Forward);

      // Again, special handling for spans
      if (boundaryChildIndex !== undefined && boundaryChildIndex > 0) {
        const beforeBoundaryNode = (dest.getFacetValue(facet) as any)?.[boundaryChildIndex - 1] as WorkingNode;
        const atBoundaryNode = (dest.getFacetValue(facet) as any)?.[boundaryChildIndex] as WorkingNode;

        // Special handling for spans, merge them
        if (beforeBoundaryNode instanceof Span && atBoundaryNode instanceof Span) {
          toJoinFollowUps.push(beforeBoundaryNode);
          // this.joinSiblingIntoNode(beforeBoundaryNode, FlowDirection.Forward);
        }
      }
    }

    this.eventEmitters.nodesJoined.emit({ destination: destNav, source: nav });

    this.deleteNodesAndGraphemesPrime([{ node: source }]);

    for (const node of toJoinFollowUps) {
      this.joinSiblingIntoNode(node, FlowDirection.Forward);
    }
  }

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

  public setNodeTextStyleModifier(
    node: NodeId | ReadonlyWorkingNode,
    facet: string | Facet,
    modifier: TextStyleModifier,
    graphemeIndex: number
  ): void {
    const resolvedNode = this.nodeLookup.get(typeof node === "string" ? node : node.id);
    if (!resolvedNode) {
      throw new WorkingDocumentError("Unknown node");
    }
    const resolvedFacet = resolvedNode.nodeType.facets.get(typeof facet === "string" ? facet : facet.name);
    if (!resolvedFacet) {
      throw new WorkingDocumentError("Unknown facet");
    }
    const value = resolvedNode.getFacetValue(resolvedFacet);
    if (value instanceof WorkingTextStyleStrip) {
      value.setModifier(graphemeIndex, modifier);
    } else {
      throw new WorkingDocumentError("Facet value is not a text style strip");
    }
  }

  // public splitNode(node: NodeId | ReadonlyWorkingNode, splitChildIndices: readonly number[]): void {
  //   const resolvedNode = this.nodeLookup.get(typeof node === "string" ? node : node.id);
  //   if (!resolvedNode) {
  //     throw new WorkingDocumentError("Unknown node");
  //   }
  //   if (!resolvedNode.parent || resolvedNode.pathPartFromParent?.index === undefined) {
  //     throw new WorkingDocumentError("Unknown node parent");
  //   }

  //   if (splitChildIndices.length === 0) {
  //     throw new WorkingDocumentError("Cannot split a node without specifying which child to split at");
  //   }

  //   if (!Utils.canNodeBeSplit(resolvedNode)) {
  //     throw new WorkingDocumentError("Node cannot be split");
  //   }

  //   const startingNav = Utils.getNodeNavigatorForNode(resolvedNode, this.actualDocument);
  //   const startingNodeChainIndex = startingNav.chain.length - 1;
  //   const nav = startingNav.clone();
  //   for (let i = 0; i < splitChildIndices.length; i++) {
  //     const childIndex = splitChildIndices[i];
  //     if (!nav.navigateToChild(childIndex)) {
  //       throw new WorkingDocumentError("Could not find target");
  //     }
  //     if (i < splitChildIndices.length - 1) {
  //       if (!Utils.canNodeBeSplit(nav.tip.node)) {
  //         throw new WorkingDocumentError("Node cannot be split");
  //       }
  //     }
  //   }

  //   const clone: Node = cloneWorkingNodeAsEmptyRegularNode(this.idGenerator, resolvedNode);
  //   const newWorkingRoot = this.insertNode(
  //     resolvedNode.parent,
  //     clone,
  //     resolvedNode.pathPartFromParent.index + 1
  //   ) as WorkingNode;

  //   let currentSplitSource: WorkingNode = resolvedNode;
  //   let currentSplitDest = newWorkingRoot;
  //   for (let i = 0; i < splitChildIndices.length; i++) {
  //     const childIndex = splitChildIndices[i];
  //     const isLastSplit = i === splitChildIndices.length - 1;

  //     const splitTarget = currentSplitSource.children![childIndex];

  //     if (splitTarget instanceof Node) {
  //       // Split the kids of the CURRENT SPLIT SOURCE, after the CURRENT node
  //       // (which will become the current split source and be modified in the
  //       // next loop)...
  //       const splitOutKids = currentSplitSource.children!.splice(
  //         childIndex,
  //         currentSplitSource.children!.length - childIndex
  //       );
  //       for (const kid of splitOutKids) {
  //         this.processNodeMoved(kid, currentSplitDest);
  //       }
  //       currentSplitDest.children = splitOutKids;

  //       const newSplitNode: ObjectNode = NodeUtils.cloneWithoutContents(splitTarget);
  //       splitOutKids.unshift(newSplitNode as any);
  //       this.processNodeCreated(newSplitNode, currentSplitDest);
  //       currentSplitDest = newSplitNode;
  //       currentSplitSource = splitTarget;
  //     } else {
  //       // Its a grapheme
  //       const textLeft = currentSplitSource.children!.slice(0, childIndex);
  //       const textRight = currentSplitSource.children!.slice(childIndex);
  //       immer.castDraft(currentSplitSource).children = immer.castDraft(textLeft);
  //       immer.castDraft(currentSplitDest).children = immer.castDraft(textRight);

  //       this.adjustAnchorPositionsAfterTextContainingNodeSplit(
  //         NodeAssociatedData.getId(currentSplitSource)!,
  //         NodeAssociatedData.getId(currentSplitDest)!,
  //         childIndex
  //       );

  //       if (childIndex === 0) {
  //         // In this case, don't leave the empty source just delete it
  //         this.deleteNode(NodeAssociatedData.getId(currentSplitSource)!);
  //       }
  //     }
  //   }

  //   // What we need to do here:
  //   // 5) Move nodes
  //   // 6) if block move latereal and annoations, deal with spanning the gap
  //   // 7) In span break text styles
  //   // 8) In general move attached anchors
  //   // 9) check that when we inesrt nodes we really clone everything!
  // }

  // public splitNodeAtPath(path: Path | PathString, splitChildIndices: readonly number[]): void {
  //   const nav = new NodeNavigator(this.document);
  //   if (!nav.navigateTo(path)) {
  //     throw new WorkingDocumentError("Cannot navigate to path");
  //   }
  //   if (NodeUtils.isGrapheme(nav.tip.node)) {
  //     throw new WorkingDocumentError("Cannot split a Grapheme");
  //   }
  //   const nodeId = this.getId(nav.tip.node);
  //   if (!nodeId) {
  //     throw new WorkingDocumentError("Cannot get id to node at path");
  //   }
  //   this.splitNode(nodeId, splitChildIndices);
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

  private moveAllNodeGraphemes(source: WorkingNode, destination: WorkingNode, prepend: boolean) {
    const destArray = destination.children as Grapheme[];
    const sourceArray = source.children as Grapheme[];
    const destArrayOriginalLength = destArray.length;
    const sourceArrayOriginalLength = sourceArray.length;

    for (const child of prepend ? lodash.reverse(sourceArray) : sourceArray) {
      prepend ? destArray.unshift(child) : destArray.push(child);
    }

    // Update anchors now
    if (prepend) {
      for (const [, anchor] of destination.attachedAnchors) {
        if (anchor.graphemeIndex !== undefined) {
          this.updateAnchor(anchor, { graphemeIndex: anchor.graphemeIndex + sourceArrayOriginalLength });
        }
      }
    }
    for (const [, anchor] of source.attachedAnchors) {
      if (prepend || anchor.graphemeIndex === undefined) {
        this.updateAnchor(anchor, { node: destination });
      } else {
        this.updateAnchor(anchor, { node: destination, graphemeIndex: anchor.graphemeIndex + destArrayOriginalLength });
      }
    }

    // Update text style strips if they exist
    for (const facet of destination.nodeType.getFacetsThatAreTextStyleStrips()) {
      let destStrip = destination.getFacetValue(facet) as WorkingTextStyleStrip | undefined;
      const sourceStrip = source.getFacetValue(facet);

      if (!destStrip && !sourceStrip) {
        continue;
      }
      if (!destStrip) {
        destStrip = new WorkingTextStyleStrip([]);
        destination.setFacet(facet, destStrip);
      }

      if (prepend) {
        destStrip.updateDueToGraphemeInsertion(0, sourceArrayOriginalLength);
      }

      if (sourceStrip && sourceStrip instanceof WorkingTextStyleStrip) {
        for (const entry of sourceStrip.entries) {
          destStrip.setModifier(entry.graphemeIndex + (prepend ? 0 : destArrayOriginalLength), entry.modifier);
        }
      }

      if (sourceArrayOriginalLength > 0 && destArrayOriginalLength > 0) {
        const boundaryIndex = prepend ? sourceArrayOriginalLength : destArrayOriginalLength;
        const resolvedStyle = destStrip.resolveStyleAt(boundaryIndex - 1);
        const modifierAtBoundary = destStrip.getModifierAt(boundaryIndex);
        const revertStyleModifier = TextStyle.createModifierToResetStyleToDefaults(resolvedStyle);

        destStrip.setModifier(boundaryIndex, { ...revertStyleModifier, ...modifierAtBoundary });
      }
    }

    for (const [, strip] of source.getAllFacetTextStyleStrips()) {
      (strip as WorkingTextStyleStrip).clear();
    }

    sourceArray.splice(0, sourceArrayOriginalLength);
  }

  private moveAllNodes(
    source: WorkingNode,
    destination: WorkingNode,
    facet: Facet | undefined, // undefined meaning "children"
    prepend: boolean
  ): { boundaryChildIndex: number | undefined } {
    const destArray = facet
      ? (destination.getFacetValue(facet) as WorkingNode[])
      : (destination.children as WorkingNode[]);
    const sourceArray = facet ? (source.getFacetValue(facet) as WorkingNode[]) : (source.children as WorkingNode[]);
    const destArrayOriginalLength = destArray.length;
    const sourceArrayOriginalLength = sourceArray.length;

    for (const child of prepend ? lodash.reverse(sourceArray) : sourceArray) {
      if (prepend) {
        destArray.unshift(child);
      } else {
        destArray.push(child);
        child.pathPartFromParent?.adjustIndex(destArrayOriginalLength);
      }
      child.parent = destination;
    }

    if (prepend) {
      for (let k = sourceArrayOriginalLength; k < destArray.length; k++) {
        destArray[k].pathPartFromParent?.adjustIndex(sourceArrayOriginalLength);
      }
    }

    // Update anchors now
    for (const [, anchor] of source.attachedAnchors) {
      this.updateAnchor(anchor, {
        node: destination,
      });
    }

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
      // This must be the document, so don't really delete it
      throw new WorkingDocumentError("Cannot delete document root node");
    }
  }
}
