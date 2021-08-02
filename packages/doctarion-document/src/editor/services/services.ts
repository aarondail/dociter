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
import { EditorNodeLookupService } from "./nodeLookupService";
import { EditorNodeTrackingService } from "./nodeTrackingService";

/**
 * These are all the services available to `EditorOperation` functions.
 */
export interface EditorOperationServices {
  readonly idGenerator: FriendlyIdGenerator;

  // TODO some other name?
  readonly execute: <ReturnType>(
    currentState: Draft<EditorState>,
    command: EditorOperationCommand<unknown, ReturnType, string>
  ) => ReturnType;

  readonly lookup: EditorNodeLookupService;
  /**
   * The node tracking service is responsible for assigning node ids, and
   * looking up nodes by id.
   *
   * Note: graphemes don't get assigned unique ids and that for ids to be
   * assigned, this service has to be called. It doesn't automagically assign
   * ids to new nodes.
   */
  readonly tracking: EditorNodeTrackingService;
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
 * These are all the services available to Editor users (not operations).
 */
export type EditorServices = Pick<EditorOperationServices, "lookup" | "layout">;

/**
 * These are services that the Editor provides in all cases.
 */
export type EditorProvidedServices = Pick<
  EditorOperationServices,
  "tracking" | "lookup" | "idGenerator" | "interactors" | "execute"
>;

/**
 * These are services that have to be provided to the Editor.
 */
export type EditorProvidableServices = Pick<EditorOperationServices, "layout">;
