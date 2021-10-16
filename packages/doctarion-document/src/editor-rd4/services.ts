import { NodeLayoutReporter } from "./nodeLayoutReporter";
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
    currentState: EditorState,
    command: EditorOperationCommand<unknown, ReturnType, string>
  ) => ReturnType;

  /**
   * The layout service doesn't layout nodes, rather it reports layout
   * information related to nodes.
   */
  readonly layout?: NodeLayoutReporter;
}

/**
 * These are services that should be provided to the Editor.
 */
export type EditorProvidableServices = Pick<EditorOperationServices, "layout">;
