import { EventChannel, EventEmitter } from "doctarion-utils";

import { EditorError } from "./error";
import { EditorState } from "./state";

export interface EditorEvents {
  /**
   * This event is fired after an operation has been run if it failed with an Error instead of completing normally.
   */
  operationHasErrored: EventChannel<EditorError>;
  /**
   * This event is fired right after an operation has been run. It has access to
   * the (mutable) EditorState that the operation (probably) updated.
   */
  operationHasRun: EventChannel<EditorState>;
  /**
   * This event is fired when an operation is about to be run. It has access to
   * the (mutable) EditorState.
   */
  operationWillRun: EventChannel<EditorState>;
}

export class EditorEventEmitter implements EditorEvents {
  public readonly operationHasErrored = new EventEmitter<EditorError>();
  public readonly operationHasRun = new EventEmitter<EditorState>();
  public readonly operationWillRun = new EventEmitter<EditorState>();
}
