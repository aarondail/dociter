import * as immer from "immer";
import lodash from "lodash";

import { NodeNavigator } from "../basic-traversal";
import { Cursor, CursorAffinity } from "../cursor";
import * as Models from "../models";
import { Range } from "../ranges";

import { moveBack, moveForward } from "./cursorOps";
import { EditorNodeIdService, EditorNodeLayoutService, EditorServices } from "./services";

export enum SelectionAnchor {
  Start = "START",
  End = "END",
}

export interface EditorState {
  readonly document: Models.Document;
  readonly cursor: Cursor;
  /**
   * Note if there is a selection the cursor should be at one of the two ends.
   */
  readonly selection?: Range;
  readonly selectionAnchor?: SelectionAnchor;
}

export class Editor {
  public readonly services: EditorServices;
  private futureList: EditorState[];
  private historyList: EditorState[];
  private state: EditorState;

  public constructor(initialDocument: Models.Document, initialCursor?: Cursor) {
    this.state = {
      // Clone because we are going to assign ids which techncially is a
      // mutation
      document: lodash.cloneDeep(initialDocument),
      cursor: initialCursor || Cursor.new([], CursorAffinity.Before),
    };
    this.historyList = [];
    this.futureList = [];

    const idService = new EditorNodeIdService();
    this.services = {
      ids: idService,
      layout: new EditorNodeLayoutService(idService),
    };

    // Assign initial ids... note this must happen before the calls to update
    // because after that the objects in the state are no longer extensible (and
    // we can't assign ids to them). I think this is something immer does.
    const n = new NodeNavigator(this.state.document);
    if (n.navigateToStartOfDfs()) {
      this.services.ids.assignId(n.tip.node);
      while (n.navigateForwardsInDfs()) {
        this.services.ids.assignId(n.tip.node);
      }
    }

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

  public get document(): Models.Document {
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

  public update(operation: (draft: immer.Draft<EditorState>, services: EditorServices) => void): void {
    const newState = immer.produce(this.state, (draft) => operation(draft, this.services));
    // If there were no changes, don't do anything
    if (newState === this.state) {
      return;
    }
    // This is far too basic...
    this.historyList.push(this.state);
    this.state = newState;
    // Reset future
    this.futureList.splice(0, this.futureList.length);
  }
}
