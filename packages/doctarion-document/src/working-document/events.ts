import { EventChannel, EventEmitter } from "doctarion-utils";

import { InteractorId } from "./interactor";

export interface WorkingDocumentEvents {
  /**
   * This event is fired when an interactor is created, when it or one of its
   * anchors is updated, or it or one of its anchors is deleted.
   */
  interactorUpdated: EventChannel<InteractorId>;
}

export class WorkingDocumentEventEmitter implements WorkingDocumentEvents {
  public readonly interactorUpdated = new EventEmitter<InteractorId>();
}
