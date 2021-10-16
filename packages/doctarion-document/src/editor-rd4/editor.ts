import { FriendlyIdGenerator } from "doctarion-utils";
import { WorkingDocumentError } from "..";

import { Path } from "../basic-traversal-rd4";
import { Cursor, CursorNavigator, CursorOrientation } from "../cursor-traversal-rd4";
import { Document } from "../document-model-rd4";

import { EditorError } from "./error";
import { EditorEventEmitter, EditorEvents } from "./events";
import { CORE_OPERATIONS, EditorOperation, EditorOperationCommand } from "./operation";
import { EditorOperationServices, EditorProvidableServices } from "./services";
import { EditorState, ReadonlyEditorState } from "./state";

export interface EditorConfig {
  // For reasons I dont fully understand typescript doesn't allow you to pass an
  // element with type `EditorOperation<void, void>` if we use `unknown` instead of
  // `any` here.
  readonly additionalOperations?: readonly EditorOperation<any, unknown, string>[];
  readonly document: Document;
  readonly cursor?: Cursor;
  readonly omitDefaultInteractor?: boolean;
  readonly provideServices?: (events: EditorEvents) => Partial<EditorProvidableServices>;
}

export class Editor {
  private readonly eventEmitters: EditorEventEmitter;
  // private futureList: EditorState[];
  // private historyList: EditorState[];
  private readonly operationRegistry: Map<string, EditorOperation<unknown, unknown, string>>;
  private readonly operationServices: EditorOperationServices;
  private workingState: EditorState;

  public constructor({
    document: initialDocument,
    cursor: initialCursor,
    provideServices,
    omitDefaultInteractor,
    additionalOperations,
  }: EditorConfig) {
    const idGenerator = new FriendlyIdGenerator();

    this.workingState = new EditorState(initialDocument, idGenerator);
    // this.historyList = [];
    // this.futureList = [];

    this.eventEmitters = new EditorEventEmitter();

    const providedServices = provideServices && provideServices(this.events);
    this.operationServices = { ...providedServices, execute: this.executeRelatedOperation };

    this.operationRegistry = new Map();
    for (const op of CORE_OPERATIONS) {
      this.operationRegistry.set(op.operationName, op);
    }
    if (additionalOperations) {
      for (const op of additionalOperations) {
        this.operationRegistry.set(op.operationName, op);
      }
    }

    // Create first interactor and focus it
    if (!omitDefaultInteractor) {
      let cursor = initialCursor;
      if (!cursor) {
        const cn = new CursorNavigator(this.workingState.document);
        cn.navigateTo(new Path(), CursorOrientation.On);
        cn.navigateToNextCursorPosition();
        cn.navigateToPrecedingCursorPosition();
        cursor = cn.cursor;
      }
      this.execute(addInteractor({ at: cursor, focused: true }));
    }
  }

  public get events(): EditorEvents {
    return this.eventEmitters;
  }

  // public get history(): readonly ReadonlyEditorState[] {
  //   return this.historyList;
  // }

  public get state(): ReadonlyEditorState {
    return this.workingState;
  }

  public execute<ReturnType>(command: EditorOperationCommand<unknown, ReturnType, string>): ReturnType {
    const op = this.operationRegistry.get(command.name);
    if (!op) {
      throw new EditorError("Unknown operation");
    }

    let result!: ReturnType;
    // const oldState = this.workingState.clone();
    try {
      this.eventEmitters.operationWillRun.emit(this.workingState);
      result = op.operationRunFunction(this.workingState, this.operationServices, command.payload) as ReturnType;
      this.eventEmitters.operationHasRun.emit(this.workingState);
    } catch (e) {
      this.eventEmitters.operationHasErrored.emit(e as any);
      // Note that until we fix this, this means that the state can be messed up
      // this.workingState = oldState;
      throw e;
    }

    return result;
  }

  // public redo(): void {
  //   const futureButNowState = this.futureList.pop();
  //   if (futureButNowState) {
  //     this.historyList.push(this.workingState);
  //     this.workingState = futureButNowState;
  //   }
  // }
  // public resetHistory(): void {
  //   this.historyList = [];
  //   this.futureList = [];
  // }

  // public undo(): void {
  //   const oldButNewState = this.historyList.pop();
  //   if (oldButNewState) {
  //     this.futureList.push(this.workingState);
  //     this.workingState = oldButNewState;
  //   }
  // }

  private executeRelatedOperation = <ReturnType>(
    updatedState: EditorState,
    command: EditorOperationCommand<unknown, ReturnType, string>
  ): ReturnType => {
    // This must only be called in the context of a currently executing operation
    const op = this.operationRegistry.get(command.name);
    if (!op) {
      throw new EditorError("Unknown operation");
    }
    return op.operationRunFunction(updatedState, this.operationServices, command.payload) as ReturnType;
  };
}
