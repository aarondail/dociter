import { EventChannel, EventEmitter } from "doctarion-utils";

import { ReadonlyNodeNavigator } from "../basic-traversal-rd4";

import { ReadonlyWorkingAnchor } from "./anchor";
import { ReadonlyInteractor } from "./interactor";
// import { NodeEditAdditionalContext } from "./workingDocument";

export interface AnchorOrphanedEventPayload {
  readonly anchor: ReadonlyWorkingAnchor;
  readonly deletionTarget: ReadonlyNodeNavigator | [ReadonlyNodeNavigator, ReadonlyNodeNavigator];
  // readonly deletionAdditionalContext?: NodeEditAdditionalContext;
}

export interface NodesJoinedEventPayload {
  readonly destination: ReadonlyNodeNavigator;
  readonly source: ReadonlyNodeNavigator;
}

export interface WorkingDocumentEvents {
  anchorAdded: EventEmitter<ReadonlyWorkingAnchor>;
  anchorDeleted: EventEmitter<ReadonlyWorkingAnchor>;
  anchorUpdated: EventEmitter<ReadonlyWorkingAnchor>;
  /**
   * This event is fired when an anchor is orphaned due to a node deletion.
   * Orphaned, meaning the node the anchor is on, or one of its parent nodes was
   * deleted. Note this does not mean the anchor is automatically deleted,
   * because it is not!
   */
  anchorOrphaned: EventChannel<AnchorOrphanedEventPayload>;
  interactorAdded: EventChannel<ReadonlyInteractor>;
  interactorDeleted: EventChannel<ReadonlyInteractor>;
  /**
   * This event is fired when an interactor is updated and/or one of its anchors
   * is updated.
   */
  interactorUpdated: EventChannel<ReadonlyInteractor>;
  nodesJoined: EventChannel<NodesJoinedEventPayload>;
}

export class WorkingDocumentEventEmitter implements WorkingDocumentEvents {
  public readonly anchorAdded = new EventEmitter<ReadonlyWorkingAnchor>();
  public readonly anchorDeleted = new EventEmitter<ReadonlyWorkingAnchor>();
  public readonly anchorOrphaned = new EventEmitter<AnchorOrphanedEventPayload>();
  public readonly anchorUpdated = new EventEmitter<ReadonlyWorkingAnchor>();

  public readonly interactorAdded = new EventEmitter<ReadonlyInteractor>();
  public readonly interactorDeleted = new EventEmitter<ReadonlyInteractor>();
  public readonly interactorUpdated = new EventEmitter<ReadonlyInteractor>();

  public readonly nodesJoined = new EventEmitter<NodesJoinedEventPayload>();
}
