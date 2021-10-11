import { FriendlyIdGenerator } from "doctarion-utils";
import * as immer from "immer";
import { immerable } from "immer";
import lodash from "lodash";

import { Chain, NodeNavigator, Path, PathString, Range } from "../basic-traversal";
import {
  Block,
  BlockContainingNode,
  Document,
  Inline,
  InlineContainingNode,
  InlineEmoji,
  InlineText,
  Node,
  NodeUtils,
  ObjectNode,
  Text,
  TextContainingNode,
} from "../document-model";

import { Anchor, AnchorId, AnchorOrientation, AnchorPosition } from "./anchor";
import { NodeDeletionAnchorMarker } from "./anchorMarkers";
import { WorkingDocumentError } from "./error";
import { WorkingDocumentEventEmitter, WorkingDocumentEvents } from "./events";
import { Interactor, InteractorAnchorType, InteractorId, InteractorStatus } from "./interactor";
import { FlowDirection } from "./misc";
import { NodeAssociatedData, NodeId } from "./nodeAssociatedData";

export interface NodeEditAdditionalContext {
  readonly flow?: FlowDirection;
}

export interface ReadonlyWorkingDocument {
  readonly document: Document;

  getAllAnchors(): readonly Anchor[];
  getAllInteractors(): readonly Interactor[];
  getAnchor(anchorId: AnchorId): Anchor | undefined;
  getInteractorAnchor(id: InteractorId | Interactor, anchorType: InteractorAnchorType): Anchor | undefined;
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

  public constructor(
    document: Document,
    private readonly idGenerator: FriendlyIdGenerator = new FriendlyIdGenerator()
  ) {
    this.document = lodash.cloneDeep(document);
    this.anchors = {};
    this.interactors = {};
    this.nodeParentIdMap = {};

    this.eventEmitters = new WorkingDocumentEventEmitter();
    this.events = this.eventEmitters;

    // Assign initial node ids
    const n = new NodeNavigator(this.document);
    n.navigateToStartOfDfs();
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
      this.eventEmitters.interactorUpdated.emit(this.interactors[relatedInteractorId]!);
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
    const newInteractor = new Interactor(id, undefined as any, status, undefined, undefined, name);
    this.interactors[id] = newInteractor;
    this.updateInteractor(id, { to: at, ...otherOptions });
    this.eventEmitters.interactorUpdated.emit(newInteractor);
    return newInteractor;
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
      this.eventEmitters.interactorUpdated.emit(this.interactors[resolvedAnchor.relatedInteractorId]!);
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

    this.eventEmitters.interactorUpdated.emit(actualInteractor);
  }

  public deleteNode(nodeId: NodeId, graphemeIndex?: number, additionalContext?: NodeEditAdditionalContext): void {
    const nav = this.createNodeNavigatorTo(nodeId, graphemeIndex);
    if (!nav) {
      throw new WorkingDocumentError("Could not find node to delete");
    }
    const anchorMarker = new NodeDeletionAnchorMarker(this as ReadonlyWorkingDocument);
    this.deleteNodeAtNodeNavigator(nav, anchorMarker);
    this.processMarkedAnchorsRelatedToNodeDeletion(anchorMarker, nav, additionalContext);
  }

  public deleteNodeAtPath(path: PathString | Path, additionalContext?: NodeEditAdditionalContext): void {
    const nav = new NodeNavigator(this.document);
    nav.navigateTo(path);
    const anchorMarker = new NodeDeletionAnchorMarker(this as ReadonlyWorkingDocument);
    this.deleteNodeAtNodeNavigator(nav, anchorMarker);
    this.processMarkedAnchorsRelatedToNodeDeletion(anchorMarker, nav, additionalContext);
  }

  public deleteNodesInRange(range: Range, additionalContext?: NodeEditAdditionalContext): void {
    const chainsToDelete = range.getChainsCoveringRange(this.document);
    if (chainsToDelete.length === 0) {
      return;
    }

    const fromNav = new NodeNavigator(this.document);
    const toNav = new NodeNavigator(this.document);
    if (!fromNav.navigateTo(range.from) || !toNav.navigateTo(range.to)) {
      throw new WorkingDocumentError("Range seems invalid");
    }

    const anchorMarker = new NodeDeletionAnchorMarker(this as ReadonlyWorkingDocument);

    const nav = new NodeNavigator(this.document);
    // This is probably a very inefficient way to deal with text.. and everything
    for (const chain of lodash.reverse(chainsToDelete)) {
      if (!nav.navigateTo(chain.path)) {
        throw new WorkingDocumentError("Could not navigate to path " + chain.path.toString() + " for deletion");
      }
      this.deleteNodeAtNodeNavigator(nav, anchorMarker);
    }

    this.processMarkedAnchorsRelatedToNodeDeletion(anchorMarker, [fromNav, toNav], additionalContext);
  }

  public getAllAnchors(): readonly Anchor[] {
    return Object.values(this.anchors) as Anchor[];
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

  public insertBlock(parent: NodeId | BlockContainingNode, index: number, block: Block): NodeId {
    const resolvedNode = typeof parent === "string" ? this.lookupNode(parent) : parent;
    if (!resolvedNode || !NodeUtils.isBlockContainer(resolvedNode)) {
      throw new WorkingDocumentError("Cannot insert block into a node that isn't a block container");
    }

    const nodeId = this.processNodeCreated(block, resolvedNode);
    for (const inline of block.children) {
      this.processNodeCreated(inline, block);
    }
    immer.castDraft(resolvedNode.children).splice(index, 0, immer.castDraft(block));
    return nodeId;
  }

  public insertInline(parent: NodeId | InlineContainingNode, index: number, inline: Inline): NodeId {
    const resolvedNode = typeof parent === "string" ? this.lookupNode(parent) : parent;
    if (!resolvedNode || !NodeUtils.isInlineContainer(resolvedNode)) {
      throw new WorkingDocumentError("Cannot insert inline into a node that isn't an inline container");
    }

    const nodeId = this.processNodeCreated(inline, resolvedNode);
    immer.castDraft(resolvedNode.children).splice(index, 0, immer.castDraft(inline));
    return nodeId;
  }

  public insertText(parent: NodeId | TextContainingNode, graphemeIndex: number, text: Text): void {
    const resolvedNode = typeof parent === "string" ? this.lookupNode(parent) : parent;
    if (!resolvedNode || !NodeUtils.isTextContainer(resolvedNode)) {
      throw new WorkingDocumentError("Cannot insert text into a node that isn't a text container");
    }

    immer.castDraft(resolvedNode.text).splice(graphemeIndex, 0, ...text);

    this.adjustAnchorPositionsAfterTextInsertion(NodeAssociatedData.getId(resolvedNode)!, graphemeIndex, text.length);
  }

  public joinBlocksAtPath(path: Path | PathString, direction: FlowDirection): void {
    const sourceNav = new NodeNavigator(this.document);
    if (!sourceNav.navigateTo(path) || !NodeUtils.isBlock(sourceNav.tip.node)) {
      throw new WorkingDocumentError("Path is invalid or doesn't point to an block");
    }

    const destinationNav = sourceNav.clone();
    if (
      !(direction === FlowDirection.Backward
        ? destinationNav.navigateToPrecedingSibling()
        : destinationNav.navigateToNextSibling()) ||
      !NodeUtils.isBlock(destinationNav.tip.node)
    ) {
      throw new WorkingDocumentError("Could not find sibling block to join to");
    }

    const destinationBlock = destinationNav.tip.node;
    const sourceBlock = sourceNav.tip.node;
    const destinationOriginalChildCount = destinationBlock.children.length;
    const sourceOriginalChildCount = sourceBlock.children.length;

    // Move children from one inline to the next
    this.moveChildren<Block>(sourceBlock, destinationBlock, direction === FlowDirection.Forward, false);

    this.adjustAnchorPositionsAfterBlockJoin(
      direction,
      sourceBlock,
      sourceOriginalChildCount,
      destinationBlock,
      destinationOriginalChildCount
    );

    this.eventEmitters.nodesJoined.emit({ destination: destinationNav, source: sourceNav });

    // Merge "boundary" InlineTexts if possible
    const inlineJoinNav = destinationNav.clone();
    if (
      inlineJoinNav.navigateToChild(
        direction === FlowDirection.Backward ? destinationOriginalChildCount - 1 : sourceOriginalChildCount - 1
      )
    ) {
      this.joinInlineTextAtNodeNavigatorIfAppropriate(inlineJoinNav);
    }

    this.deleteNodeAtPath(sourceNav.path, { flow: direction });
  }

  public joinInlineTextAtPath(
    path: Path | PathString,
    direction: FlowDirection,
    options?: { readonly onlyIfModifiersAreCompatible?: boolean }
  ): void {
    const sourceNav = new NodeNavigator(this.document);
    if (!sourceNav.navigateTo(path) || !(sourceNav.tip.node instanceof InlineText)) {
      throw new WorkingDocumentError("Path is invalid or doesn't point to an InlineText");
    }

    const destinationNav = sourceNav.clone();
    if (
      !(direction === FlowDirection.Backward
        ? destinationNav.navigateToPrecedingSibling()
        : destinationNav.navigateToNextSibling()) ||
      !(destinationNav.tip.node instanceof InlineText)
    ) {
      throw new WorkingDocumentError("Could not find sibling InlineText to join to");
    }

    const destinationInlineText = destinationNav.tip.node;
    const sourceInlineText = sourceNav.tip.node;
    const destinationOriginalChildCount = destinationInlineText.children.length;
    const sourceOriginalChildCount = sourceInlineText.children.length;

    if (
      options?.onlyIfModifiersAreCompatible &&
      !(
        destinationOriginalChildCount === 0 ||
        sourceOriginalChildCount === 0 ||
        lodash.isEqual(destinationInlineText.modifiers, sourceInlineText.modifiers)
      )
    ) {
      return;
    }

    // Move children from one inline to the next
    this.moveChildren(sourceInlineText, destinationInlineText, direction === FlowDirection.Forward, true);

    // Adjust modifiers in edge case of an empty inline text
    if (destinationOriginalChildCount === 0) {
      immer.castDraft(destinationInlineText).modifiers = sourceInlineText.modifiers;
    }

    this.adjustAnchorPositionsAfterInlineTextJoin(
      direction,
      sourceInlineText,
      sourceOriginalChildCount,
      destinationInlineText,
      destinationOriginalChildCount
    );

    this.eventEmitters.nodesJoined.emit({ destination: destinationNav, source: sourceNav });

    this.deleteNodeAtPath(sourceNav.path);
  }

  public lookupChainTo(nodeId: NodeId): Chain | undefined {
    return this.createNodeNavigatorTo(nodeId)?.chain;
  }

  public lookupNode(nodeId: NodeId): Node | undefined {
    return this.createNodeNavigatorTo(nodeId)?.tip.node;
  }

  public lookupPathTo(nodeId: NodeId): Path | undefined {
    return this.createNodeNavigatorTo(nodeId)?.path;
  }

  public splitNode(target: NodeId | Inline | Block, splitChildIndices: readonly number[]): void {
    if (splitChildIndices.length === 0) {
      throw new WorkingDocumentError("Cannot split a node without specifying which child to split at");
    }

    if (splitChildIndices.every((x) => x === 0)) {
      // There is no reason to do anything in this case since we'd be creating
      // an identical node.
      return;
    }

    const targetNav = this.createNodeNavigatorTo(
      typeof target === "string" ? target : NodeAssociatedData.getId(target) || ""
    );
    if (!targetNav) {
      throw new WorkingDocumentError("Could not find target");
    }

    const resolvedTarget = targetNav.tip.node;
    if (!NodeUtils.isObject(resolvedTarget)) {
      throw new WorkingDocumentError("Cannot split a Grapheme");
    }
    if (resolvedTarget instanceof InlineEmoji) {
      throw new WorkingDocumentError("Cannot split an InlineEmoji");
    }
    if (resolvedTarget instanceof Document) {
      throw new WorkingDocumentError("Cannot split the Document ");
    }

    const targetIndexInParent = targetNav.tip.pathPart.index;
    const targetParent = targetNav.parent?.node;
    if (!targetParent || !NodeUtils.isObject(targetParent) || !targetParent.children) {
      throw new WorkingDocumentError("Cannot split a node because it has no parent (somehow)");
    }

    const tipNav = targetNav.clone();
    for (const index of splitChildIndices) {
      if (!tipNav.navigateToChild(index)) {
        throw new WorkingDocumentError("Could not navigate to descendant of target");
      }
    }

    // The tip of the split must not have children
    if ((NodeUtils.getChildren(tipNav.tip.node)?.length || 0) !== 0) {
      throw new WorkingDocumentError("Split impossible due to children remaining at the end of the indices");
    }

    // Create a split destination for the target, and add it into the parent
    const newSplitRoot: ObjectNode = NodeUtils.cloneWithoutContents(resolvedTarget);
    immer.castDraft(targetParent.children).splice(targetIndexInParent + 1, 0, immer.castDraft(newSplitRoot));
    this.processNodeCreated(newSplitRoot, targetParent);

    // Now go through the indices and split them
    let currentSplitSource: ObjectNode = resolvedTarget;
    let currentSplitDest = newSplitRoot;
    for (const splitIndex of splitChildIndices) {
      const current = currentSplitSource.children![splitIndex]!;
      if (NodeUtils.isGrapheme(current)) {
        const textLeft = currentSplitSource.children!.slice(0, splitIndex);
        const textRight = currentSplitSource.children!.slice(splitIndex);
        immer.castDraft(currentSplitSource).children = immer.castDraft(textLeft);
        immer.castDraft(currentSplitDest).children = immer.castDraft(textRight);

        this.adjustAnchorPositionsAfterTextContainingNodeSplit(
          NodeAssociatedData.getId(currentSplitSource)!,
          NodeAssociatedData.getId(currentSplitDest)!,
          splitIndex
        );

        if (splitIndex === 0) {
          // In this case, don't leave the empty source just delete it
          this.deleteNode(NodeAssociatedData.getId(currentSplitSource)!);
        }
      } else if (current instanceof InlineEmoji) {
        const splitOutKids = immer
          .castDraft(currentSplitSource)
          .children!.splice(splitIndex, currentSplitSource.children!.length - splitIndex);
        for (const kid of splitOutKids) {
          this.processNodeMoved(kid, currentSplitDest);
        }
        immer.castDraft(currentSplitDest).children = splitOutKids;
      } else {
        // Split the kids of the CURRENT SPLIT SOURCE, after the CURRENT node
        // (which will become the current split source and be modified in the
        // next loop)...
        const splitOutKids = immer
          .castDraft(currentSplitSource)
          .children!.splice(splitIndex + 1, currentSplitSource.children!.length - splitIndex);
        for (const kid of splitOutKids) {
          this.processNodeMoved(kid, currentSplitDest);
        }
        currentSplitDest.children = splitOutKids;

        if ((current.children?.length || 0) === 0) {
          // In this case, don't leave the empty source just delete it
          this.deleteNode(NodeAssociatedData.getId(current)!);
        }

        const newSplitNode: ObjectNode = NodeUtils.cloneWithoutContents(current);
        splitOutKids.unshift(newSplitNode as any);
        this.processNodeCreated(newSplitNode, currentSplitDest);
        currentSplitDest = newSplitNode;
        currentSplitSource = current;
      }
    }
  }

  public splitNodeAtPath(path: Path | PathString, splitChildIndices: readonly number[]): void {
    const nav = new NodeNavigator(this.document);
    if (!nav.navigateTo(path)) {
      throw new WorkingDocumentError("Cannot navigate to path");
    }
    if (NodeUtils.isGrapheme(nav.tip.node)) {
      throw new WorkingDocumentError("Cannot split a Grapheme");
    }
    const nodeId = this.getId(nav.tip.node);
    if (!nodeId) {
      throw new WorkingDocumentError("Cannot get id to node at path");
    }
    this.splitNode(nodeId, splitChildIndices);
  }

  public updateAnchor(
    id: AnchorId,
    updates: {
      readonly nodeId?: NodeId;
      readonly orientation?: AnchorOrientation;
      readonly graphemeIndex?: number | undefined;
    }
  ): void;
  public updateAnchor(
    id: AnchorId,
    nodeId: NodeId,
    orientation: AnchorOrientation,
    graphemeIndex: number | undefined
  ): void;
  updateAnchor(
    id: AnchorId,
    nodeIdOrUpdates: any,
    orientation?: AnchorOrientation,
    graphemeIndex?: number | undefined
  ): void {
    const anchor = this.anchors[id];
    if (!anchor) {
      return;
    }

    if (typeof nodeIdOrUpdates === "string") {
      immer.castDraft(anchor).nodeId = nodeIdOrUpdates;
      immer.castDraft(anchor).orientation = orientation!;
      immer.castDraft(anchor).graphemeIndex = graphemeIndex!;
    } else {
      const updates = nodeIdOrUpdates;
      if (updates.nodeId) {
        immer.castDraft(anchor).nodeId = updates.nodeId;
      }
      if (updates.orientation) {
        immer.castDraft(anchor).orientation = updates.orientation;
      }
      if ("graphemeIndex" in updates) {
        immer.castDraft(anchor).graphemeIndex = updates.graphemeIndex;
      }
    }

    this.eventEmitters.anchorUpdated.emit(anchor);

    if (anchor.relatedInteractorId) {
      this.eventEmitters.interactorUpdated.emit(this.interactors[anchor.relatedInteractorId]!);
    }
  }

  public updateInteractor(
    id: InteractorId,
    updates: {
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

    if ("lineMovementHorizontalVisualPosition" in updates) {
      interactor.lineMovementHorizontalVisualPosition = updates.lineMovementHorizontalVisualPosition;
    }

    if ("selectTo" in updates) {
      if (updates.selectTo) {
        let anchorInfo: AnchorPosition | undefined;
        if (updates.selectTo === "main") {
          anchorInfo = this.getAnchor(interactor.mainAnchor);
          if (!anchorInfo) {
            throw new WorkingDocumentError("Interactor is missing main anchor");
          }
        } else {
          anchorInfo = updates.selectTo;
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

    if (updates.to) {
      const anchorInfo = updates.to;
      if (interactor.mainAnchor) {
        const mainAnchor = this.getAnchor(interactor.mainAnchor);
        if (!mainAnchor) {
          throw new WorkingDocumentError("Interactor is missing main anchor in WorkingDocument");
        }

        this.updateAnchor(interactor.mainAnchor, anchorInfo);
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

    if ("name" in updates) {
      interactor.name = updates.name;
    }

    if (updates.status) {
      interactor.status = updates.status;
    }

    this.eventEmitters.interactorUpdated.emit(interactor);
  }

  private adjustAnchorPositionsAfterBlockJoin(
    direction: FlowDirection,
    source: Block,
    sourceOriginalChildCount: number,
    destination: Block,
    destinationOriginalChildCount: number
  ) {
    const destinationId = NodeAssociatedData.getId(destination);
    const sourceId = NodeAssociatedData.getId(source);

    if (!destinationId || !sourceId) {
      return;
    }

    if (direction === FlowDirection.Backward) {
      // Nothing to do
    } else {
      for (const a of this.getAllAnchors()) {
        // Destination
        if (a.nodeId === destinationId) {
          if (destinationOriginalChildCount === 0 && sourceOriginalChildCount > 0) {
            this.updateAnchor(a.id, a.nodeId, AnchorOrientation.After, a.graphemeIndex);
          }
        }
        // Source
        // else if (a.nodeId === sourceId) {
        //   if (a.graphemeIndex === undefined && destinationOriginalChildCount > 0) {
        //     this.updateAnchor(a.id, destinationId, AnchorOrientation.Before, undefined);
        //   }
        // }
      }
    }
  }

  private adjustAnchorPositionsAfterInlineTextJoin(
    direction: FlowDirection,
    source: InlineText,
    sourceOriginalChildCount: number,
    destination: InlineText,
    destinationOriginalChildCount: number
  ) {
    const destinationId = NodeAssociatedData.getId(destination);
    const sourceId = NodeAssociatedData.getId(source);

    if (!destinationId || !sourceId) {
      return;
    }

    const caseBackwardsDestination = (anchor: Anchor) => {
      if (anchor.nodeId === destinationId && destinationOriginalChildCount === 0 && sourceOriginalChildCount > 0) {
        this.updateAnchor(anchor.id, anchor.nodeId, AnchorOrientation.Before, 0);
      }
    };

    const caseForwardDestination = (anchor: Anchor) => {
      if (anchor.nodeId === destinationId) {
        if (anchor.graphemeIndex !== undefined) {
          this.updateAnchor(
            anchor.id,
            anchor.nodeId,
            anchor.orientation,
            sourceOriginalChildCount + anchor.graphemeIndex
          );
        }
      }
    };

    const caseBackwardSource = (anchor: Anchor) => {
      if (anchor.nodeId === sourceId) {
        if (anchor.graphemeIndex !== undefined) {
          this.updateAnchor(
            anchor.id,
            destinationId,
            anchor.orientation,
            destinationOriginalChildCount + anchor.graphemeIndex
          );
        } else if (destinationOriginalChildCount > 0) {
          this.updateAnchor(anchor.id, destinationId, AnchorOrientation.After, destinationOriginalChildCount - 1);
        }
      }
    };

    const caseForwardSource = (anchor: Anchor) => {
      if (anchor.nodeId === sourceId) {
        if (anchor.graphemeIndex === undefined && destinationOriginalChildCount > 0) {
          this.updateAnchor(anchor.id, destinationId, AnchorOrientation.Before, 0);
        } else {
          this.updateAnchor(anchor.id, destinationId, anchor.orientation, anchor.graphemeIndex);
        }
      }
    };

    for (const a of this.getAllAnchors()) {
      if (direction === FlowDirection.Backward) {
        caseBackwardsDestination(a);
        caseBackwardSource(a);
      } else {
        caseForwardDestination(a);
        caseForwardSource(a);
      }
    }
  }

  private adjustAnchorPositionsAfterTextContainingNodeSplit(
    sourceId: NodeId,
    targetId: NodeId,
    graphemeSplitIndex: number
  ) {
    for (const anchor of this.getAllAnchors()) {
      if (anchor.nodeId === sourceId) {
        if (anchor.graphemeIndex !== undefined && anchor.graphemeIndex >= graphemeSplitIndex) {
          this.updateAnchor(anchor.id, { nodeId: targetId, graphemeIndex: anchor.graphemeIndex - graphemeSplitIndex });
        }
      }
    }
  }

  private adjustAnchorPositionsAfterTextInsertion(nodeId: NodeId, insertionIndex: number, insertionCount: number) {
    for (const anchor of this.getAllAnchors()) {
      if (anchor.nodeId === nodeId) {
        if (anchor.graphemeIndex !== undefined && anchor.graphemeIndex >= insertionIndex) {
          this.updateAnchor(anchor.id, { graphemeIndex: anchor.graphemeIndex + insertionCount });
        }
      }
    }
  }

  private createNodeNavigatorTo(nodeId: NodeId, graphemeIndex?: number): NodeNavigator | undefined {
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

      if (!nav.navigateToChild(index)) {
        throw new WorkingDocumentError("Could not navigate to child while constructing a NodeNavigator");
      }
    }

    if (graphemeIndex !== undefined) {
      if (!nav.navigateToChild(graphemeIndex)) {
        throw new WorkingDocumentError("Could not navigate to child while constructing a NodeNavigator");
      }
    }

    return nav;
  }

  private deleteNodeAtNodeNavigator(navigator: NodeNavigator, anchorMarker: NodeDeletionAnchorMarker): void {
    const node = navigator.tip.node;
    const parent = navigator.parent?.node;
    const pathPart = navigator.tip.pathPart;
    const kidIndex = pathPart?.index;
    const kids = parent && NodeUtils.getChildren(parent);

    // This shouldn't be possible
    if (parent && (!kids || kidIndex === undefined)) {
      throw new WorkingDocumentError("Node has parent without children which should be impossible");
    }

    // Unregister all child nodes and the node itself
    if (!NodeUtils.isGrapheme(node)) {
      navigator.traverseDescendants(
        (n) => {
          this.processNodeDeleted(n);
          anchorMarker.markAnchorsDirectlyOnNode(NodeAssociatedData.getId(n) || "");
        },
        { skipGraphemes: true }
      );
      if (parent && kids) {
        this.processNodeDeleted(node);
        anchorMarker.markAnchorsDirectlyOnNode(NodeAssociatedData.getId(node) || "");

        immer.castDraft(kids).splice(kidIndex, 1);
      } else {
        // This is the Document node case
        immer.castDraft(node).children = [];
      }
    } else {
      // This is the grapheme case, note that at this point we always expect kids
      // to be defined
      if (parent && kids) {
        immer.castDraft(kids).splice(kidIndex, 1);
        anchorMarker.markAnchorsRelativeToGrapheme(NodeAssociatedData.getId(parent) || "", kidIndex);
      }
    }
  }

  private joinInlineTextAtNodeNavigatorIfAppropriate(navigator: NodeNavigator) {
    if (!NodeUtils.isInlineText(navigator.tip.node)) {
      return;
    }
    const otherBoundaryInlineChildNav = navigator.clone();
    if (
      otherBoundaryInlineChildNav.navigateToNextSibling() &&
      NodeUtils.isInlineText(otherBoundaryInlineChildNav.tip.node)
    ) {
      if (
        NodeUtils.getChildren(navigator.tip.node)?.length === 0 &&
        (NodeUtils.getChildren(otherBoundaryInlineChildNav.tip.node)?.length || 0) > 0
      ) {
        this.joinInlineTextAtPath(otherBoundaryInlineChildNav.path, FlowDirection.Backward, {
          onlyIfModifiersAreCompatible: true,
        });
      } else {
        this.joinInlineTextAtPath(navigator.path, FlowDirection.Forward, {
          onlyIfModifiersAreCompatible: true,
        });
      }
    }
  }

  private moveChildren<T extends ObjectNode>(
    source: T extends Block ? Block : InlineText,
    destination: T extends Block ? Block : InlineText,
    prependChildren?: boolean,
    childrenAreAllGraphemes?: boolean
  ) {
    if (childrenAreAllGraphemes) {
      if (!prependChildren) {
        immer.castDraft(destination).children = [...destination.children, ...source.children];
      } else {
        immer.castDraft(destination).children = [...source.children, ...destination.children];
      }
    } else {
      const destKids = immer.castDraft(destination.children);
      if (prependChildren) {
        for (const child of lodash.reverse(source.children)) {
          destKids.unshift(child);
          this.processNodeMoved(child, destination);
        }
      } else {
        for (const child of source.children) {
          destKids.push(child);
          this.processNodeMoved(child, destination);
        }
      }
    }
    immer.castDraft(source).children = [];
  }

  private processMarkedAnchorsRelatedToNodeDeletion(
    anchorMarker: NodeDeletionAnchorMarker,
    deletionTarget: NodeNavigator | [NodeNavigator, NodeNavigator],
    deletionAdditionalContext: NodeEditAdditionalContext | undefined
  ) {
    const orphanedAnchors: Anchor[] = [];
    for (const { anchor, relativeGraphemeDeletionCount } of anchorMarker.getMarkedAnchors()) {
      if (relativeGraphemeDeletionCount === undefined || anchor.graphemeIndex === undefined) {
        orphanedAnchors.push(anchor);
      } else {
        this.updateAnchor(
          anchor.id,
          anchor.nodeId,
          anchor.orientation,
          anchor.graphemeIndex - relativeGraphemeDeletionCount
        );
      }
    }

    if (orphanedAnchors.length > 0) {
      this.eventEmitters.anchorsOrphaned.emit({
        anchors: orphanedAnchors,
        deletionTarget,
        deletionAdditionalContext,
      });
    }
  }

  private processNodeCreated(node: ObjectNode, parent: Node | NodeId | undefined): NodeId {
    const nodeId = this.idGenerator.generateId((node as any).kind || "DOCUMENT");
    const parentId = parent && (typeof parent === "string" ? parent : NodeAssociatedData.getId(parent));
    NodeAssociatedData.assignId(node, nodeId);
    parentId && NodeAssociatedData.assignParentId(node, parentId);
    this.nodeParentIdMap[nodeId] = parentId;
    return nodeId;
  }

  private processNodeDeleted(node: NodeId | ObjectNode): void {
    const id = typeof node === "string" ? node : NodeAssociatedData.getId(node);
    if (id) {
      delete this.nodeParentIdMap[id];
    }
  }

  private processNodeMoved(node: Node, newParent: NodeId | ObjectNode): void {
    const nodeId = NodeAssociatedData.getId(node);
    const parentId = typeof newParent === "string" ? newParent : NodeAssociatedData.getId(newParent);
    parentId && NodeAssociatedData.assignParentId(node, parentId);
    if (nodeId) {
      this.nodeParentIdMap[nodeId] = parentId;
    }
  }
}
