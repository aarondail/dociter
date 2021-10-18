import { FriendlyIdGenerator } from "doctarion-utils";

import { Path } from "../basic-traversal-rd4";
import { Cursor, CursorNavigator, CursorOrientation } from "../cursor-traversal-rd4";
import { Document } from "../document-model-rd4";
import { InteractorId, ReadonlyInteractor, ReadonlyWorkingDocument, WorkingDocument } from "../working-document-rd4";
import { CursorService } from "./cursorService";

import { EditorError } from "./error";
import { EditorEventEmitter, EditorEvents } from "./events";
import { CORE_OPERATIONS, EditorOperation, EditorOperationCommand } from "./operation";
import { EditorOperationServices, EditorProvidableServices } from "./services";

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
  private currentOperationState?: {
    interactorsUpdated?: boolean;
  };
  private readonly eventEmitters: EditorEventEmitter;
  // private futureList: EditorState[];
  // private historyList: EditorState[];
  private readonly operationRegistry: Map<string, EditorOperation<unknown, unknown, string>>;
  private readonly operationServices: EditorOperationServices;
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
      // TODO do we really need this
      cursor: new CursorService(this.workingState),
      dedupeInteractors: this.dedupeInteractors,
      execute: this.executeRelatedOperation,
    };

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

  public get state(): ReadonlyWorkingDocument {
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

      // Post operation cleanup
      if (this.currentOperationState?.interactorsUpdated) {
        this.dedupeInteractors();
      }

      this.eventEmitters.operationHasRun.emit(this.workingState);
    } catch (e) {
      this.eventEmitters.operationHasErrored.emit(e as any);
      // Note that until we fix this, this means that the state can be messed up
      // this.workingState = oldState; // DONT DO THIS THIS BREAKS THE SERVICES
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

  /**
   * There definitely could be more situations in which we want to dedupe
   * interactors, but for right now we only dedupe interactors that aren't a
   * selection AND have the same status AND their mainCursor is equal.
   *
   * This must be called after the interactorOrdering has been sorted.
   */
  private dedupeInteractors = (): InteractorId[] | undefined => {
    const interactors = this.workingState.interactors;
    if (interactors.size < 2) {
      return;
    }

    // Try to remove any interactors that are exact matches for another
    // interactor, but only consider NON-selections. Its unclear at this
    // point what the best behavior for selections would be.
    let dupeIds: InteractorId[] | undefined;
    const seenKeys = new Set<string>();
    for (const [, i] of interactors) {
      if (i.selectionAnchor) {
        continue;
      }
      const key = `${i.mainAnchor.node.id}${i.mainAnchor.orientation}${i.mainAnchor.graphemeIndex || ""}${i.status}`;
      if (seenKeys.has(key)) {
        if (!dupeIds) {
          dupeIds = [];
        }
        dupeIds.push(i.id);
      }
      seenKeys.add(key);
    }

    if (dupeIds) {
      for (const id of dupeIds) {
        this.workingState.deleteInteractor(id);
      }
    }
    return dupeIds;
  };

  private executeRelatedOperation = <ReturnType>(
    command: EditorOperationCommand<unknown, ReturnType, string>
  ): ReturnType => {
    // This must only be called in the context of a currently executing operation
    const op = this.operationRegistry.get(command.name);
    if (!op) {
      throw new EditorError("Unknown operation");
    }
    return op.operationRunFunction(this.workingState, this.operationServices, command.payload) as ReturnType;
  };

  private handleInteractorUpdated = () => {
    if (!this.currentOperationState) {
      this.currentOperationState = {};
    }
    this.currentOperationState.interactorsUpdated = true;
  };
}
