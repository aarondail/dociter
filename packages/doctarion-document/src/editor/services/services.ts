// -----------------------------------------------------------------------------
// Editor Services provide functionality that support operations and clients of
// the Editor. They can have their own mutable state (albeit there is a
// limitation that it cannot participate in undo and redo), and they can affect
// and access the EditorState.
// -----------------------------------------------------------------------------

import { FriendlyIdGenerator } from "doctarion-utils";
import { Draft } from "immer";

import { NodeLayoutReporter } from "../../layout-reporting";
import { EditorOperationCommand } from "../operation";
import { EditorState } from "../state";

import { EditorInteractorService } from "./interactorService";

/**
 * These are all the services available to `EditorOperation` functions.
 */
export interface EditorOperationServices {
  // TODO delete
  readonly idGenerator: FriendlyIdGenerator;

  /**
   * Use this to execute (during an operation) another related operation.  You
   * have to pass the state (the draft of the immer state).
   */
  readonly execute: <ReturnType>(
    currentState: Draft<EditorState>,
    command: EditorOperationCommand<unknown, ReturnType, string>
  ) => ReturnType;

  /**
   * The layout service doesn't layout nodes, rather it reports layout
   * information related to nodes.
   */
  readonly layout?: NodeLayoutReporter;
  /**
   * The interactor service is responsible for all changes to interactors.
   */
  readonly interactors: EditorInteractorService;
}

/**
 * These are services that have to be provided to the Editor.
 */
export type EditorProvidableServices = Pick<EditorOperationServices, "layout">;
