import { FriendlyIdGenerator } from "doctarion-utils";
import * as immer from "immer";
import lodash from "lodash";

import { NodeNavigator, Path } from "../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation } from "../cursor";
import { Interactor } from "../editor";
import { Document } from "../models";

import { EditorEventEmitter, EditorEvents } from "./events";
import { addInteractor } from "./interactorOps";
import { CORE_OPERATIONS, EditorOperation, EditorOperationCommand } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import {
  EditorInteractorService,
  EditorNodeLookupService,
  EditorNodeTrackingService,
  EditorOperationServices,
  EditorProvidableServices,
  EditorProvidedServices,
  EditorServices,
} from "./services";
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
  readonly provideServices?: (
    services: EditorProvidedServices,
    events: EditorEvents
  ) => Partial<EditorProvidableServices>;
}

export class Editor {
  public readonly events: EditorEvents;
  public readonly services: EditorServices;

  private readonly eventEmitters: EditorEventEmitter;
  private futureList: EditorState[];
  private historyList: EditorState[];
  private readonly operationRegistry: Map<string, EditorOperation<unknown, unknown, string>>;
  private readonly operationServices: EditorOperationServices;
  private state: EditorState;

  public constructor({
    document: initialDocument,
    cursor: initialCursor,
    provideServices,
    omitDefaultInteractor,
    additionalOperations,
  }: EditorConfig) {
    const idGenerator = new FriendlyIdGenerator();

    this.state = {
      // Clone because we are going to assign ids which technically is a
      // mutation
      document: lodash.cloneDeep(initialDocument),
      interactors: {},
      interactorOrdering: [],
      focusedInteractorId: undefined,
      nodeParentMap: {},
    };
    this.historyList = [];
    this.futureList = [];

    this.eventEmitters = new EditorEventEmitter();
    this.events = this.eventEmitters;

    this.operationServices = {
      idGenerator,
      interactors: new EditorInteractorService(this.events),
      lookup: new EditorNodeLookupService(this.state, this.events),
      // Note the tracking service is supposed to be used only during
      // operations, which is why it wants mutable state
      tracking: new EditorNodeTrackingService(idGenerator, this.events),
      execute: this.executeRelatedOperation,
    };

    if (provideServices) {
      this.operationServices = {
        ...this.operationServices,
        ...provideServices(this.operationServices, this.events),
      };
    }

    this.services = this.operationServices;

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

    // Assign initial ids... note this must happen before the calls to update
    // because after that the objects in the state are no longer extensible (and
    // we can't assign ids to them). I think this is something immer does.
    const n = new NodeNavigator(this.state.document);
    n.navigateToStartOfDfs();
    this.operationServices.tracking.register(n.tip.node, undefined);
    n.traverseDescendants((node, parent) => this.operationServices.tracking.register(node, parent), {
      skipGraphemes: true,
    });

    // Create first interactor and focus it
    if (!omitDefaultInteractor) {
      let cursor = initialCursor;
      if (!cursor) {
        const cn = new CursorNavigator(this.state.document, undefined);
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
    return this.state.document;
  }

  public get history(): readonly EditorState[] {
    return this.historyList;
  }

  public get interactors(): EditorState["interactors"] {
    return this.state.interactors;
  }

  public get interactorOrdering(): EditorState["interactorOrdering"] {
    return this.state.interactorOrdering;
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
    if (newState.document !== oldState.document) {
      this.eventEmitters.documentHasBeenUpdated.emit(this.state.document);
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
