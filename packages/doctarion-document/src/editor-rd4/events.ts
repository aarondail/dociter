import { EventChannel, EventEmitter } from "doctarion-utils";

import { WorkingDocument } from "../working-document-rd4";

import { EditorError } from "./error";

export interface EditorEvents {
  /**
   * This event is fired after an operation has been run if it failed with an Error instead of completing normally.
   */
  operationHasErrored: EventChannel<EditorError>;
  /**
   * This event is fired right after an operation has been run. It has access to
   * the (mutable) EditorState that the operation (probably) updated.
   */
  operationHasRun: EventChannel<WorkingDocument>;
  /**
   * This event is fired when an operation is about to be run. It has access to
   * the (mutable) ReadonlyWorkingDocument.
   */
  operationWillRun: EventChannel<WorkingDocument>;
}

export class EditorEventEmitter implements EditorEvents {
  public readonly operationHasErrored = new EventEmitter<EditorError>();
  public readonly operationHasRun = new EventEmitter<WorkingDocument>();
  public readonly operationWillRun = new EventEmitter<WorkingDocument>();
}
