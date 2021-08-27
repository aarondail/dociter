// -----------------------------------------------------------------------------
// Editor Services provide functionality that support operations and clients of
// the Editor.
// -----------------------------------------------------------------------------

import { Draft } from "immer";

import { NodeLayoutReporter } from "../cursor";

import { EditorInteractorService } from "./interactorService";
import { EditorOperationCommand } from "./operation";
import { EditorState } from "./state";

/**
 * These are all the services available to `EditorOperation` functions.
 */
export interface EditorOperationServices {
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
