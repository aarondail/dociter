import { EventChannel, EventEmitter } from "doctarion-utils";
import { Draft } from "immer";

import { Document } from "../models";

import { EditorState } from "./state";

export interface EditorEvents {
  /**
   * This event is fired right after an operation has been run. It has access to
   * the (mutable) draft EditorState that the operation (probably) updated.
   */
  operationHasRun: EventChannel<Draft<EditorState>>;
  /**
   * This event is fired when an operation is about to be run. It has access to
   * the (mutable) draft EditorState.
   */
  operationWillRun: EventChannel<Draft<EditorState>>;
  /**
   * This event is fired after an operation (and the has run and will run
   * events) have fired, and has access to the final (immutable) EditorState as
   * a result of the operation.
   */
  operationHasCompleted: EventChannel<EditorState>;
  /**
   * This event is similar to operationHasCompleted but only fires if the
   * Document was changed by the operation.
   */
  documentHasBeenUpdated: EventChannel<Document>;
}

export class EditorEventEmitter implements EditorEvents {
  public readonly documentHasBeenUpdated = new EventEmitter<Document>();
  public readonly operationHasCompleted = new EventEmitter<EditorState>();
  public readonly operationHasRun = new EventEmitter<Draft<EditorState>>();
  public readonly operationWillRun = new EventEmitter<Draft<EditorState>>();
}
