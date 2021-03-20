import * as immer from "immer";

import { Cursor, CursorAffinity } from "../cursor";
import * as Models from "../models";

export interface EditorState {
  readonly document: Models.Document;
  readonly cursor: Cursor;
  // readonly selection?;
  // readonly seletionMode?;
}

export class Editor {
  private futureList: EditorState[];
  private historyList: EditorState[];
  private state: EditorState;

  public constructor(initialDocument: Models.Document, initialCursor?: Cursor) {
    this.state = {
      document: initialDocument,
      cursor: initialCursor || Cursor.new([], CursorAffinity.Before),
    };
    this.historyList = [];
    this.futureList = [];
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

  // public getNavigatorAtCursor(): DocumentElementNavigator {
  //   const n = new DocumentElementNavigator(this.state.document);
  //   switch (this.state.interloc.kind) {
  //     case DocumentInteractionLocationKind.CURSOR:
  //       n.navigateTo(this.state.interloc.at);
  //       break;
  //     case DocumentInteractionLocationKind.SELECTION:
  //       throw new Error("Not implemented yet");
  //   }
  //   return n;
  // }

  public resetHistory(): void {
    this.historyList = [];
    this.futureList = [];
  }

  public update(operation: (draft: immer.Draft<EditorState>) => void): void {
    const newState = immer.produce(this.state, operation);
    // If there were no changes, don't do anything
    if (newState === this.state) {
      return;
    }
    this.historyList.push(this.state);
    this.state = newState;
    // Reset future
    this.futureList.splice(0, this.futureList.length);
  }
}
