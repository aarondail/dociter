import { FriendlyIdGenerator } from "doctarion-utils";
import * as immer from "immer";

import { Path } from "../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation } from "../cursor";
import { Interactor } from "../editor";
import { Document } from "../models";
import { ReadonlyWorkingDocument, WorkingDocument } from "../working-document";

import { EditorEventEmitter, EditorEvents } from "./events";
import { addInteractor } from "./interactorOps";
import { CORE_OPERATIONS, EditorOperation, EditorOperationCommand } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { EditorInteractorService, EditorOperationServices, EditorProvidableServices } from "./services";
import { EditorState } from "./state";

export interface EditorConfig {
  // For reasons I dont fully understand typescript doesn't allow you to pass an
  // element with type `EditorOperation<void, void>` if we use `unknown` instead of
  // `any` here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly additionalOperations?: readonly EditorOperation<any, unknown, string>[];
  readonly document: Document;
  readonly cursor?: Cursor;
  readonly omitDefaultInteractor?: boolean;
  readonly provideServices?: (events: EditorEvents) => Partial<EditorProvidableServices>;
}

export class Editor {
  public readonly events: EditorEvents;
  // TODO make private once we move interactors into state (rather than as a service)
  public readonly operationServices: EditorOperationServices;

  private readonly eventEmitters: EditorEventEmitter;
  private futureList: EditorState[];
  private historyList: EditorState[];
  private readonly operationRegistry: Map<string, EditorOperation<unknown, unknown, string>>;
  private state: EditorState;

  public constructor({
    document: initialDocument,
    cursor: initialCursor,
    provideServices,
    omitDefaultInteractor,
    additionalOperations,
  }: EditorConfig) {
    const idGenerator = new FriendlyIdGenerator();

    const workingDocument = new WorkingDocument(initialDocument as immer.Draft<Document>, idGenerator);
    this.state = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      document2: workingDocument as any,
      // Clone because we are going to assign ids which technically is a
      // mutation
      interactors: {},
      focusedInteractorId: undefined,
    };
    this.historyList = [];
    this.futureList = [];

    this.eventEmitters = new EditorEventEmitter();
    this.events = this.eventEmitters;

    const providedServices = provideServices && provideServices(this.events);

    this.operationServices = {
      ...providedServices,
      idGenerator,
      interactors: new EditorInteractorService(this.events, idGenerator, providedServices?.layout),
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
        const cn = new CursorNavigator(this.state.document2.document, undefined);
        cn.navigateTo(new Path([]), CursorOrientation.On);
        cn.navigateToNextCursorPosition();
        cn.navigateToPrecedingCursorPosition();
        cursor = cn.cursor;
      }
      this.execute(addInteractor({ at: cursor, focused: true }));
    }
  }

  public get focusedInteractor(): Interactor | undefined {
    if (this.state.focusedInteractorId !== undefined) {
      return this.state.interactors[this.state.focusedInteractorId];
    }
    return undefined;
  }

  public get document(): Document {
    return this.state.document2.document;
  }

  public get history(): readonly EditorState[] {
    return this.historyList;
  }

  public get interactors(): EditorState["interactors"] {
    return this.state.interactors;
  }

  public get workingDocument(): ReadonlyWorkingDocument {
    return this.state.document2;
  }

  public execute<ReturnType>(command: EditorOperationCommand<unknown, ReturnType, string>): ReturnType {
    const op = this.operationRegistry.get(command.name);
    if (!op) {
      throw new EditorOperationError(EditorOperationErrorCode.UnknownOperation);
    }

    let result!: ReturnType;
    const oldState = this.state;
    const newState = immer.produce(this.state, (draft) => {
      this.eventEmitters.operationWillRun.emit(draft);
      result = op.operationRunFunction(draft, this.operationServices, command.payload) as ReturnType;
      this.eventEmitters.operationHasRun.emit(draft);
    });

    // If there were no changes, don't do anything
    if (newState !== this.state) {
      // This is far too basic...
      this.historyList.push(this.state);
      this.state = newState;
      // Reset future
      this.futureList.splice(0, this.futureList.length);
    }
    this.eventEmitters.operationHasCompleted.emit(this.state);
    if (newState.document2.document !== oldState.document2.document) {
      this.eventEmitters.documentHasBeenUpdated.emit(this.state.document2.document);
    }

    return result;
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
