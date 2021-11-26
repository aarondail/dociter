import { EventChannel, EventEmitter } from "doctarion-utils";

import { ReadonlyNodeNavigator } from "../traversal";

import { ReadonlyWorkingAnchor } from "./anchor";
import { ReadonlyWorkingInteractor } from "./interactor";
// import { NodeEditAdditionalContext } from "./workingDocument";

export interface AnchorOrphanedEventPayload {
  readonly anchor: ReadonlyWorkingAnchor;
}

export interface NodesJoinedEventPayload {
  readonly destination: ReadonlyNodeNavigator;
  readonly source: ReadonlyNodeNavigator;
}

export interface WorkingDocumentEvents {
  anchorAdded: EventEmitter<ReadonlyWorkingAnchor>;
  anchorDeleted: EventEmitter<ReadonlyWorkingAnchor>;
  anchorUpdated: EventEmitter<ReadonlyWorkingAnchor>;
  interactorAdded: EventChannel<ReadonlyWorkingInteractor>;
  interactorDeleted: EventChannel<ReadonlyWorkingInteractor>;
  /**
   * This event is fired when an interactor is updated and/or one of its anchors
   * is updated.
   */
  interactorUpdated: EventChannel<ReadonlyWorkingInteractor>;
  nodesJoined: EventChannel<NodesJoinedEventPayload>;
}

export class WorkingDocumentEventEmitter implements WorkingDocumentEvents {
  public readonly anchorAdded = new EventEmitter<ReadonlyWorkingAnchor>();
  public readonly anchorDeleted = new EventEmitter<ReadonlyWorkingAnchor>();
  public readonly anchorUpdated = new EventEmitter<ReadonlyWorkingAnchor>();

  public readonly interactorAdded = new EventEmitter<ReadonlyWorkingInteractor>();
  public readonly interactorDeleted = new EventEmitter<ReadonlyWorkingInteractor>();
  public readonly interactorUpdated = new EventEmitter<ReadonlyWorkingInteractor>();

  public readonly nodesJoined = new EventEmitter<NodesJoinedEventPayload>();
}
