import { EventChannel, EventEmitter } from "doctarion-utils";

import { ReadonlyNodeNavigator } from "../basic-traversal";

import { Anchor } from "./anchor";
import { Interactor } from "./interactor";
import { NodeEditAdditionalContext } from "./workingDocument";

export interface AnchorsOrphanedEventPayload {
  readonly anchors: readonly Anchor[];
  readonly deletionTarget: ReadonlyNodeNavigator | [ReadonlyNodeNavigator, ReadonlyNodeNavigator];
  readonly deletionAdditionalContext?: NodeEditAdditionalContext;
}

export interface WorkingDocumentEvents {
  /**
   * This event is fired when an anchor is orphaned due to a node deletion.
   * Orphaned, meaning the node the anchor is on, or one of its parent nodes was
   * deleted.
   */
  anchorsOrphaned: EventChannel<AnchorsOrphanedEventPayload>;
  /**
   * This event is fired when an interactor is created, when it or one of its
   * anchors is updated, or it or one of its anchors is deleted.
   */
  interactorUpdated: EventChannel<Interactor>;
}

export class WorkingDocumentEventEmitter implements WorkingDocumentEvents {
  public readonly anchorsOrphaned = new EventEmitter<AnchorsOrphanedEventPayload>();
  public readonly interactorUpdated = new EventEmitter<Interactor>();
}
