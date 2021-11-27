import { FriendlyIdGenerator } from "doctarion-utils";

import { CORE_COMMANDS, Command, CommandInfo, CommandServices, CommandUtils, Commands } from "../commands";
import { DocumentNode } from "../document-model";
import { CursorNavigator, CursorOrientation, CursorPath, Path } from "../traversal";
import { ReadonlyWorkingDocument, WorkingDocument } from "../working-document";

import { EditorError } from "./error";
import { EditorEventEmitter, EditorEvents } from "./events";

/**
 * These are services that should be provided to the Editor.
 */
export type EditorProvidableServices = Pick<CommandServices, "layout">;

export interface EditorConfig {
  // For reasons I dont fully understand typescript doesn't allow you to pass an
  // element with type `EditorOperation<void, void>` if we use `unknown` instead of
  // `any` here.
  readonly additionalOperations?: readonly CommandInfo<any, unknown, string>[];
  readonly document: DocumentNode;
  readonly cursor?: CursorPath;
  readonly omitDefaultInteractor?: boolean;
  readonly provideServices?: (events: EditorEvents) => Partial<EditorProvidableServices>;
}

export class Editor {
  private currentOperationState?: {
    interactorsUpdated?: boolean;
  };
  private readonly eventEmitters: EditorEventEmitter;
  // private futureList: EditorState[];
  // private historyList: EditorState[];
  private readonly operationRegistry: Map<string, CommandInfo<unknown, unknown, string>>;
  private readonly operationServices: CommandServices;
  private workingState: WorkingDocument;

  public constructor({
    document: initialDocument,
    cursor: initialCursor,
    provideServices,
    omitDefaultInteractor,
    additionalOperations,
  }: EditorConfig) {
    const idGenerator = new FriendlyIdGenerator();

    this.workingState = new WorkingDocument(initialDocument, idGenerator);
    this.workingState.events.interactorUpdated.addListener(this.handleInteractorUpdated);

    // this.historyList = [];
    // this.futureList = [];

    this.eventEmitters = new EditorEventEmitter();

    const providedServices = provideServices && provideServices(this.events);
    this.operationServices = {
      ...providedServices,
      execute: this.executeRelatedOperation,
    };

    this.operationRegistry = new Map();
    for (const op of CORE_COMMANDS) {
      this.operationRegistry.set(op.name, op);
    }
    if (additionalOperations) {
      for (const op of additionalOperations) {
        this.operationRegistry.set(op.name, op);
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
      this.execute(Commands.addInteractor({ at: cursor, focused: true }));
    }
  }

  public get events(): EditorEvents {
    return this.eventEmitters;
  }

  // public get history(): readonly ReadonlyEditorState[] {
  //   return this.historyList;
  // }

  public get state(): ReadonlyWorkingDocument {
    return this.workingState;
  }

  public execute<ReturnType>(command: Command<unknown, ReturnType, string>): ReturnType {
    const op = this.operationRegistry.get(command.name);
    if (!op) {
      throw new EditorError("Unknown operation");
    }

    let result!: ReturnType;
    // const oldState = this.workingState.clone();
    try {
      this.eventEmitters.operationWillRun.emit(this.workingState);
      result = op.executor(this.workingState, this.operationServices, command.payload) as ReturnType;

      // Post operation cleanup
      if (this.currentOperationState?.interactorsUpdated) {
        CommandUtils.dedupeInteractors(this.workingState);
      }

      this.eventEmitters.operationHasRun.emit(this.workingState);
    } catch (e) {
      this.eventEmitters.operationHasErrored.emit(e as any);
      // Note that until we fix this, this means that the state can be messed up
      // this.workingState = oldState; // DONT DO THIS THIS BREAKS STUFF
      throw e;
    } finally {
      this.currentOperationState = undefined;
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

  private executeRelatedOperation = <ReturnType>(command: Command<unknown, ReturnType, string>): ReturnType => {
    // This must only be called in the context of a currently executing operation
    const op = this.operationRegistry.get(command.name);
    if (!op) {
      throw new EditorError("Unknown operation");
    }
    return op.executor(this.workingState, this.operationServices, command.payload) as ReturnType;
  };

  private handleInteractorUpdated = () => {
    if (!this.currentOperationState) {
      this.currentOperationState = {};
    }
    this.currentOperationState.interactorsUpdated = true;
  };
}
