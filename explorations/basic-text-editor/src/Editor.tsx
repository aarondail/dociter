import * as DoctarionDocument from "doctarion-document";
import React from "react";

import { Cursor } from "./Cursor";
import { DocumentNode } from "./DocumentNode";
import { EditorContext } from "./EditorContext";
import { InputInterpreter } from "./InputInterpreter";

import "./Editor.css";

export enum InputMode {
  Command,
  Insert,
}

export enum EditorCommand {
  Undo,
  Redo,
  SwitchToInsertMode,
  SwitchToCommandMode,
}

export interface EditorProps {
  readonly initialDocument: DoctarionDocument.Document;
}

/**
 * Why aren't we using React state?
 *
 * Well some of the objects like the Editor are mutable, so changes have to go
 * through forceUpdate. Additionally, other objects like the Cursor and the
 * InputInterpreter have to be updated after changes and making it synchronous
 * (i.e. not relying on setState and its callback) has kept things a little
 * simpler and made it easy to deal with some bugs.
 *
 * That said there may be a verison of this that uses state that is better than
 * what we have here.
 */
export class Editor extends React.PureComponent<EditorProps> {
  private cursorRef?: Cursor | null;
  private editor: DoctarionDocument.Editor;
  private fontsLoaded?: boolean;
  private inputInterpreter: InputInterpreter;
  private insertionTextareaRef?: HTMLTextAreaElement | null;
  private mainDivRef?: HTMLDivElement | null;

  public constructor(props: EditorProps) {
    super(props);

    this.editor = new DoctarionDocument.Editor(this.props.initialDocument);
    this.inputInterpreter = new InputInterpreter(this.dispatchEditorOperationOrCommand, InputMode.Command);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (window as any).e = this.editor;
  }

  public async componentDidMount(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    await (window.document as any).fonts.load("12px Source Serif");
    this.fontsLoaded = true;
    this.forceUpdate();
  }

  public componentDidUpdate(): void {
    // We have to reposition the cursor if the document changed due to the fact
    // that there may be new DOM nodes registered or the layout of existing ones
    // may have changed.
    this.syncCursorPositionAndEtc();
  }

  public render(): JSX.Element {
    return (
      <div
        ref={this.setMainDivRef}
        className="Editor-main"
        tabIndex={0}
        onKeyDown={this.handleKeyDown}
        onKeyUp={this.handleKeyUp}
      >
        <textarea
          ref={this.setInsertionTextareaRef}
          className="Editor-textarea"
          // disabled={this.inputInterpreter.inputMode !== InputMode.Insert}
          tabIndex={0}
          onKeyDown={this.handleTextareaKeyDown}
          onKeyUp={this.handleTextareaKeyUp}
          wrap="off"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
          onBlur={this.handleTextareaBlur}
          onCompositionStart={this.handleTextareaCompositionStart}
          onCompositionUpdate={this.handleTextareaCompositionUpdate}
          onCompositionEnd={this.handleTextareaCompositionEnd}
          onInput={this.handleTextareaInput}
          onChange={this.handleTextareaChange}
        ></textarea>
        <Cursor ref={this.setCursorsRef} />
        {this.fontsLoaded && (
          <EditorContext.Provider value={this.editor.services}>
            <DocumentNode node={this.editor.document} />
          </EditorContext.Provider>
        )}
      </div>
    );
  }

  private dispatchEditorOperationOrCommand = (
    operationOrCommand: DoctarionDocument.EditorOperation | EditorCommand
  ) => {
    switch (operationOrCommand) {
      case EditorCommand.Redo:
        this.editor.redo();
        break;
      case EditorCommand.SwitchToCommandMode:
        this.inputInterpreter.inputMode = InputMode.Command;
        this.mainDivRef?.focus();
        break;
      case EditorCommand.SwitchToInsertMode:
        console.log("HERE", this.insertionTextareaRef);
        this.inputInterpreter.inputMode = InputMode.Insert;
        this.insertionTextareaRef?.focus();
        break;
      case EditorCommand.Undo:
        this.editor.undo();
        break;
      default:
        this.editor.update(operationOrCommand);
    }

    this.forceUpdate();
  };

  private handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    console.log("TEST_MAINDIV keydown");
    this.inputInterpreter.inputMode === InputMode.Command && this.inputInterpreter?.keyDown(e);
  };

  private handleKeyUp = (e: React.KeyboardEvent<HTMLElement>) =>
    this.inputInterpreter.inputMode === InputMode.Command && this.inputInterpreter?.keyUp(e);

  private handleTextareaBlur = () => {
    // Keep focus on the text area
    if (this.inputInterpreter.inputMode === InputMode.Insert) {
      this.insertionTextareaRef?.focus();
    }
  };

  private handleTextareaChange = (e: React.ChangeEvent<HTMLElement>) =>
    // Not sure if this does anything actually
    e.preventDefault();

  private handleTextareaCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) =>
    this.inputInterpreter?.compositionEnd(e);

  private handleTextareaCompositionStart = (e: React.CompositionEvent<HTMLTextAreaElement>) =>
    this.inputInterpreter?.compositionStart(e);

  private handleTextareaCompositionUpdate = (e: React.CompositionEvent<HTMLTextAreaElement>) =>
    this.inputInterpreter?.compositionUpdate(e);

  private handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    this.inputInterpreter?.input(e);
    // if (taRef.current) {
    //   taRef.current.value = "";
    // }
  };

  private handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    console.log("TEST keydown");
    this.inputInterpreter.inputMode === InputMode.Insert && this.inputInterpreter?.keyDown(e);
  };

  private handleTextareaKeyUp = (e: React.KeyboardEvent<HTMLElement>) =>
    this.inputInterpreter.inputMode === InputMode.Insert && this.inputInterpreter?.keyUp(e);

  private setCursorsRef = (cursor: Cursor | null) => {
    this.cursorRef = cursor;
  };

  private setInsertionTextareaRef = (textarea: HTMLTextAreaElement | null) => {
    this.insertionTextareaRef = textarea;
  };

  private setMainDivRef = (div: HTMLDivElement | null) => {
    this.mainDivRef = div;
    if (this.mainDivRef && this.inputInterpreter.inputMode === InputMode.Command) {
      this.mainDivRef.focus();
    }
  };

  private syncCursorPositionAndEtc() {
    const cursorPosition = this.cursorRef?.layout(
      this.editor.cursor,
      this.editor.document,
      this.editor.services.layout
    );
    if (this.insertionTextareaRef) {
      this.insertionTextareaRef.style.left = cursorPosition ? `${cursorPosition.left}px` : "";
      this.insertionTextareaRef.style.top = cursorPosition ? `${cursorPosition.top}px` : "";
      this.insertionTextareaRef.style.height = cursorPosition ? `${cursorPosition.height}px` : "";
    }
  }
}