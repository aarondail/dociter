import { InteractorId } from "../working-document-rd4";

import { Command } from "./commands/types";
import { CursorService } from "./cursorService";
import { NodeLayoutService } from "./nodeLayoutService";

/**
 * These are all the services available to `EditorOperation` functions.
 */
export interface EditorServices {
  readonly cursor: CursorService;

  readonly dedupeInteractors: () => InteractorId[] | undefined;

  /**
   * Use this to execute (during an operation) another related operation.  You
   * have to pass the state (the draft of the immer state).
   */
  readonly execute: <ReturnType>(command: Command<unknown, ReturnType, string>) => ReturnType;

  /**
   * The layout service doesn't layout nodes, rather it reports layout
   * information related to nodes.
   */
  readonly layout?: NodeLayoutService;
}

/**
 * These are services that should be provided to the Editor.
 */
export type EditorProvidableServices = Pick<EditorServices, "layout">;
