import { EventChannel, EventEmitter } from "doctarion-utils";
import { Draft } from "immer";

import { Document } from "../models";

import { EditorState } from "./state";

export interface EditorEvents {
  updateDone: EventChannel<EditorState>;
  updateStart: EventChannel<Draft<EditorState>>;
  documentUpdated: EventChannel<Document>;
}

export class EditorEventEmitter implements EditorEvents {
  public readonly documentUpdated = new EventEmitter<Document>();
  public readonly updateDone = new EventEmitter<EditorState>();
  public readonly updateStart = new EventEmitter<Draft<EditorState>>();
}
