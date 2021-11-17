import { AnchorOrientation, Node, Span } from "../document-model-rd5";
import { FlowDirection } from "../miscUtils";
import { PseudoNode } from "../traversal-rd4";

import { AnchorId, AnchorParameters, ReadonlyWorkingAnchor, WorkingAnchor } from "./anchor";
import { WorkingDocumentError } from "./error";
import { WorkingNode } from "./nodes";
import { InternalDocumentLocation, Utils } from "./utils";
import { ReadonlyWorkingDocument } from "./workingDocument";

import { WorkingAnchorType } from ".";

export interface AnchorUpdateAssistantHost
  extends Pick<
    ReadonlyWorkingDocument,
    "getAnchorParametersFromCursorNavigator" | "getCursorNavigatorForAnchor" | "getNodeNavigator"
  > {
  addTransientAnchor(parameters: AnchorParameters): ReadonlyWorkingAnchor;
  updateAnchor(anchor: AnchorId | ReadonlyWorkingAnchor, parameters: Partial<AnchorParameters>): void;
  deleteAnchor(anchor: ReadonlyWorkingAnchor): void;
}

/**
 * Internal meaning not to be exposed outside this folder.
 */
export type ContiguousOrderedInternalDocumentLocationArray = readonly InternalDocumentLocation[];

export class AnchorUpdateAssistantForNodeDeletion {
  private anchorsOriginatingFromDeletedNodes = new Set<WorkingAnchor>();
  private anchorsPointingToDeletedNodes = new Set<WorkingAnchor>();
  private relationAnchor: ReadonlyWorkingAnchor;
  private relationAnchorType: "parent" | "sibling";

  public constructor(
    private readonly host: AnchorUpdateAssistantHost,
    contiguousOrderedLocationArrayToBeDeleted: ContiguousOrderedInternalDocumentLocationArray,
    private readonly direction: FlowDirection,
    private readonly accommodateSpansThatMayHaveBeenJoined: boolean
  ) {
    // This is info related to where we will reposition anchors that are within
    // the delete location array... it isn't the final location per se. Because
    // we have to do some adjustment after the deletions to get the best final
    // location.
    const anchorRelocationInfo = AnchorUpdateAssistantForNodeDeletion.getClosestAdjacentOrParentLocationOutsideOfLocationArray(
      host,
      contiguousOrderedLocationArrayToBeDeleted,
      direction
    );

    this.relationAnchorType = anchorRelocationInfo.type;

    // This has to be deleted before we are done
    this.relationAnchor = this.host.addTransientAnchor({
      ...anchorRelocationInfo.location,
      orientation: AnchorOrientation.On,
    });
  }

  public cleanUp(): void {
    if (this.relationAnchor) {
      this.host.deleteAnchor(this.relationAnchor);
    }
  }

  public commitUpdatesAndDeletion(): void {
    for (const anchor of this.anchorsOriginatingFromDeletedNodes) {
      this.host.deleteAnchor(anchor);
    }

    // These may be node-to-node and interactor anchors
    const orphanedAnchorsNeedingRepositioning = [];
    for (const anchor of this.anchorsPointingToDeletedNodes) {
      if (this.anchorsOriginatingFromDeletedNodes.has(anchor)) {
        continue;
      }
      orphanedAnchorsNeedingRepositioning.push(anchor);
      // this.eventEmitters.anchorOrphaned.emit({ anchor });
      if (this.relationAnchor === anchor) {
        throw new Error("Unexpectedly found the orphan relocation anchor");
      }
    }

    let orphanedAnchorRelocationNavUpdatedPosition: AnchorParameters;
    {
      const c = this.host.getCursorNavigatorForAnchor(this.relationAnchor);
      if ((c.tip.node as Node)?.children && this.relationAnchorType === "parent") {
        this.direction === FlowDirection.Backward
          ? c.navigateToFirstDescendantCursorPosition()
          : c.navigateToLastDescendantCursorPosition();
      } else if ((c.tip.node as Node)?.children) {
        this.direction === FlowDirection.Backward
          ? c.navigateToLastDescendantCursorPosition()
          : c.navigateToFirstDescendantCursorPosition();

        // Special edge case that we wanna handle in the case where there are
        // spans to be joined and instead of landing BEFORE the first grapheme
        // in the span we landed after it (because there is a Span preceding
        // it which will be joined below).
        if (
          this.accommodateSpansThatMayHaveBeenJoined &&
          this.direction === FlowDirection.Forward &&
          PseudoNode.isGrapheme(c.tip.node) &&
          c.cursor.orientation === AnchorOrientation.After &&
          c.tip.pathPart?.index === 0 &&
          (c.parent?.node as Node).nodeType === Span &&
          (c.toNodeNavigator().precedingParentSiblingNode as Node).nodeType === Span
        ) {
          c.navigateToPrecedingCursorPosition();
        }
      } else {
        this.direction === FlowDirection.Backward
          ? Utils.navigateCursorNavigatorToLastCursorPositionOnTheSameNode(c)
          : Utils.navigateCursorNavigatorToFirstCursorPositionOnTheSameNode(c);
      }
      orphanedAnchorRelocationNavUpdatedPosition = this.host.getAnchorParametersFromCursorNavigator(c);
    }

    for (const anchor of orphanedAnchorsNeedingRepositioning) {
      this.host.updateAnchor(anchor.id, orphanedAnchorRelocationNavUpdatedPosition);
    }
  }

  public recordAnchorsOriginatingFromAndPointingToNode(node: WorkingNode): void {
    for (const [, anchor] of node.attachedAnchors) {
      this.anchorsPointingToDeletedNodes.add(anchor);
    }
    for (const anchor of Utils.traverseAllAnchorsOriginatingFrom(node)) {
      this.anchorsOriginatingFromDeletedNodes.add(anchor);
    }
  }

  public recordOrUpdateAnchorsOriginatingFromNodeGrapheme(node: WorkingNode, graphemeIndex: number): void {
    for (const anchor of node.attachedAnchors.values()) {
      if (anchor.graphemeIndex !== undefined) {
        if (anchor.graphemeIndex === graphemeIndex) {
          this.anchorsPointingToDeletedNodes.add(anchor);
        } else if (anchor.graphemeIndex > graphemeIndex) {
          // I think, this doesn't really count as an anchor update
          // (since its just keeping it at the same place)... so there
          // is no reason to call updateAnchor here
          anchor.graphemeIndex--;
        }
      }
    }
  }

  private static getClosestAdjacentOrParentLocationOutsideOfLocationArray(
    host: AnchorUpdateAssistantHost,
    contiguousOrderedLocationArray: ContiguousOrderedInternalDocumentLocationArray,
    direction: FlowDirection
  ): { location: InternalDocumentLocation; type: "parent" | "sibling" } {
    if (contiguousOrderedLocationArray.length === 0) {
      throw new WorkingDocumentError("Did not expect the location array to be empty");
    }
    const isBack = direction === FlowDirection.Backward;
    const location = contiguousOrderedLocationArray[isBack ? 0 : contiguousOrderedLocationArray.length - 1];

    const nav = host.getNodeNavigator(location.node);
    if (location.graphemeIndex !== undefined) {
      nav.navigateToChild(location.graphemeIndex);
    }

    // This will not jump to a cursor position in another node
    if (isBack ? nav.navigateToPrecedingSibling() : nav.navigateToNextSibling()) {
      if (location.graphemeIndex !== undefined) {
        const node = nav.parent?.node as WorkingNode;
        return { location: { node, graphemeIndex: nav.tip.pathPart!.index }, type: "sibling" };
      } else {
        const node = nav.tip.node as WorkingNode;
        return { location: { node }, type: "sibling" };
      }
    } else {
      // Note this can be the document
      nav.navigateToParent();
      const node = nav.tip.node as WorkingNode;
      return { location: { node }, type: "parent" };
    }
  }
}

export class AnchorUpdateAssistantForNodeJoin {
  public static performUpdate(
    host: AnchorUpdateAssistantHost,
    joinDestinationNode: WorkingNode,
    direction: FlowDirection
  ): void {
    for (const [, anchor] of joinDestinationNode.attachedAnchors) {
      if (
        anchor.type === WorkingAnchorType.Interactor &&
        anchor.graphemeIndex === undefined &&
        anchor.orientation === AnchorOrientation.On
      ) {
        const n = host.getCursorNavigatorForAnchor(anchor);
        direction === FlowDirection.Backward ? n.navigateToPrecedingCursorPosition() : n.navigateToNextCursorPosition();
        // Just update them now
        host.updateAnchor(anchor, host.getAnchorParametersFromCursorNavigator(n));
      }
      // Other anchor types will just be moved wholesale to the destination node which is ok I think
    }
  }
}
