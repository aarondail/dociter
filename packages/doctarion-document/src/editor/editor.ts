import * as immer from "immer";
import { Draft } from "immer";
import lodash from "lodash";

import { NodeNavigator } from "../basic-traversal";
import { Cursor, CursorAffinity } from "../cursor";
import { Document } from "../models";
import { Range } from "../ranges";

import { moveBack, moveForward } from "./cursorOps";
import { NodeId } from "./nodeId";
import {
  EditorNodeLayoutService,
  EditorNodeLookupService,
  EditorNodeTrackingService,
  EditorOperationServices,
  EditorServices,
} from "./services";

export enum SelectionAnchor {
  Start = "START",
  End = "END",
}

export type EditorOperation = (draft: immer.Draft<EditorState>, services: EditorOperationServices) => void;

export interface EditorState {
  readonly document: Document;
  readonly cursor: Cursor;
  /**
   * Note if there is a selection the cursor should be at one of the two ends.
   */
  readonly selection?: Range;
  readonly selectionAnchor?: SelectionAnchor;

  /**
   * When moving between lines visually, this value stores cursor's x value at
   * the start of the line movement, so we can intelligently move between lines
   * of different length and have the cursor try to go to the right spot.
   */
  readonly cursorVisualLineMovementXHint?: number;

  // This big long object may be a poor fit for immer... not sure what to do about it though
  readonly nodeParentMap: { readonly [id: string /* NodeId */]: NodeId | undefined };
}

export class Editor {
  public readonly services: EditorServices;
  private futureList: EditorState[];
  private historyList: EditorState[];
  private readonly operationServices: EditorOperationServices;
  private state: EditorState;

  public constructor(initialDocument: Document, initialCursor?: Cursor) {
    this.state = {
      // Clone because we are going to assign ids which techncially is a
      // mutation
      document: lodash.cloneDeep(initialDocument),
      cursor: initialCursor || Cursor.new([], CursorAffinity.Before),
      nodeParentMap: {},
    };
    this.historyList = [];
    this.futureList = [];

    this.services = {
      lookup: new EditorNodeLookupService(this.state),
      layout: new EditorNodeLayoutService(),
    };
    this.operationServices = {
      ...this.services,
      // Note the tracking service is supposed to be used only during
      // operations, which is why it wants mutable state
      tracking: new EditorNodeTrackingService(this.state as Draft<EditorState>),
    };

    // Assign initial ids... note this must happen before the calls to update
    // because after that the objects in the state are no longer extensible (and
    // we can't assign ids to them). I think this is something immer does.
    const n = new NodeNavigator(this.state.document);
    n.navigateToStartOfDfs();
    this.operationServices.tracking.register(n.tip.node, undefined);
    n.traverseDescendants((node, parent) => this.operationServices.tracking.register(node, parent), {
      skipGraphemes: true,
    });

    if (initialCursor === undefined) {
      // Adjust the cursor so its on a valid position
      try {
        this.update(moveForward);
        this.update(moveBack);
      } catch {
        // Intentionally ignore problems
        // Maybe we should throw?
      }
    }
  }

  public get cursor(): Cursor {
    return this.state.cursor;
  }

  public get document(): Document {
    return this.state.document;
  }

  public get history(): readonly EditorState[] {
    return this.historyList;
  }

  public redo(): void {
    const futureButNowState = this.futureList.pop();
    if (futureButNowState) {
      this.historyList.push(this.state);
      this.state = futureButNowState;
    }
  }
  public resetHistory(): void {
    this.historyList = [];
    this.futureList = [];
  }

  public undo(): void {
    const oldButNewState = this.historyList.pop();
    if (oldButNewState) {
      this.futureList.push(this.state);
      this.state = oldButNewState;
    }
  }

  public update(operation: EditorOperation): void {
    const newState = immer.produce(this.state, (draft) => {
      this.operationServices.lookup.editorState = draft;
      this.operationServices.tracking.editorState = draft;
      operation(draft, this.operationServices);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      this.operationServices.tracking.editorState = null as any; // JIC
    });
    // If there were no changes, don't do anything
    if (newState === this.state) {
      return;
    }
    // This is far too basic...
    this.historyList.push(this.state);
    this.state = newState;
    // Reset future
    this.futureList.splice(0, this.futureList.length);
    this.services.lookup.editorState = this.state;
  }
}
