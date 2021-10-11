import { FriendlyIdGenerator } from "doctarion-utils";
import * as immer from "immer";

import { Path } from "../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation } from "../cursor";
import { Document } from "../document-model";
import { Anchor, AnchorId } from "../working-document";

import { EditorEventEmitter, EditorEvents } from "./events";
import { addInteractor } from "./interactorOps";
import { EditorInteractorService } from "./interactorService";
import { CORE_OPERATIONS, EditorOperation, EditorOperationCommand } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
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
  public readonly events: EditorEvents;

  private readonly eventEmitters: EditorEventEmitter;
  private futureList: EditorState[];
  private historyList: EditorState[];
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

    let workingState = new EditorState(initialDocument as immer.Draft<Document>, idGenerator);
    workingState = immer.produce(workingState, (x) => x);

    this.workingState = workingState;
    this.historyList = [];
    this.futureList = [];

    this.eventEmitters = new EditorEventEmitter();
    this.events = this.eventEmitters;

    const providedServices = provideServices && provideServices(this.events);

    this.operationServices = {
      ...providedServices,
      interactors: new EditorInteractorService(
        this.events,
        (this.workingState as unknown) as immer.Draft<EditorState>,
        providedServices?.layout
      ),
      execute: this.executeRelatedOperation,
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
        const cn = new CursorNavigator(this.workingState.document, undefined);
        cn.navigateTo(new Path([]), CursorOrientation.On);
        cn.navigateToNextCursorPosition();
        cn.navigateToPrecedingCursorPosition();
        cursor = cn.cursor;
      }
      this.execute(addInteractor({ at: cursor, focused: true }));
    }
  }

  public get history(): readonly ReadonlyEditorState[] {
    return this.historyList;
  }

  public get state(): ReadonlyEditorState {
    return this.workingState;
  }

  public anchorToCursor(anchor: AnchorId | Anchor): Cursor {
    return this.operationServices.interactors.anchorToCursor(anchor);
  }

  public execute<ReturnType>(command: EditorOperationCommand<unknown, ReturnType, string>): ReturnType {
    const op = this.operationRegistry.get(command.name);
    if (!op) {
      throw new EditorOperationError(EditorOperationErrorCode.UnknownOperation);
    }

    let result!: ReturnType;
    const oldState = this.workingState;
    const newState = immer.produce(this.workingState, (draft) => {
      this.eventEmitters.operationWillRun.emit(draft);
      result = op.operationRunFunction(draft, this.operationServices, command.payload) as ReturnType;
      this.eventEmitters.operationHasRun.emit(draft);
    });

    // If there were no changes, don't do anything
    if (newState !== this.workingState) {
      // This is far too basic...
      this.historyList.push(this.workingState);
      this.workingState = newState;
      // Reset future
      this.futureList.splice(0, this.futureList.length);
    }
    this.eventEmitters.operationHasCompleted.emit(this.workingState);
    if (newState.document !== oldState.document) {
      this.eventEmitters.documentHasBeenUpdated.emit(this.workingState.document);
    }

    return result;
  }

  public redo(): void {
    const futureButNowState = this.futureList.pop();
    if (futureButNowState) {
      this.historyList.push(this.workingState);
      this.workingState = futureButNowState;
    }
  }
  public resetHistory(): void {
    this.historyList = [];
    this.futureList = [];
  }

  public undo(): void {
    const oldButNewState = this.historyList.pop();
    if (oldButNewState) {
      this.futureList.push(this.workingState);
      this.workingState = oldButNewState;
    }
  }

  private executeRelatedOperation = <ReturnType>(
    updatedState: immer.Draft<EditorState>,
    command: EditorOperationCommand<unknown, ReturnType, string>
  ): ReturnType => {
    // This must only be called in the context of a currently executing operation
    const op = this.operationRegistry.get(command.name);
    if (!op) {
      throw new EditorOperationError(EditorOperationErrorCode.UnknownOperation);
    }
    return op.operationRunFunction(updatedState, this.operationServices, command.payload) as ReturnType;
  };
}
