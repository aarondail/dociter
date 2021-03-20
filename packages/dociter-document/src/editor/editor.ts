import * as immer from "immer";

import { Cursor, CursorAffinity } from "../cursor";
import * as Models from "../models";

export interface EditorState {
  readonly document: Models.Document;
  readonly cursor: Cursor;
  // selection?
  // seletionMode?
}

// interface HistoryEntry {
//   // readonly patches: immer.Patch[];
//   // readonly inversePatches: immer.Patch[];
// }

export class DocumentEditor {
  private future: EditorState[];
  private history: EditorState[];
  private state: EditorState;

  public constructor(initialDocument: Models.Document, initialCursor?: Cursor) {
    this.state = {
      document: initialDocument,
      cursor: initialCursor || Cursor.new([], CursorAffinity.Before),
    };
    this.history = [];
    this.future = [];
  }

  public get cursor(): Cursor {
    return this.state.cursor;
  }

  public get document(): Models.Document {
    return this.state.document;
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

  // public get changes(): readonly immer.Patch[][] {
  //   return this.history.map((e) => e.patches);
  // }

  // public debugState(): string {
  //   return debugStateHelpers.debugStateSimple(this.state);
  // }

  // public debugCurrentBlock(): string {
  //   let path = "block:";
  //   switch (this.state.interloc.kind) {
  //     case DocumentInteractionLocationKind.CURSOR:
  //       path += this.state.interloc.at?.[0][1];
  //       break;
  //     case DocumentInteractionLocationKind.SELECTION:
  //       path += this.state.interloc.selection?.[0][0][1];
  //       break;
  //   }
  //   return debugStateHelpers.debugBlockSimple(this.state.document, path);
  // }

  public resetHistory(): void {
    this.history = [];
    this.future = [];
  }

  public update(operation: (draft: immer.Draft<EditorState>) => void): void {
    const newState = immer.produce(this.state, operation);
    // If there were no changes, don't do anything
    if (newState === this.state) {
      return;
    }
    this.history.push(this.state);
    this.state = newState;
    // Reset future
    this.future.splice(0, this.future.length);
  }
}
