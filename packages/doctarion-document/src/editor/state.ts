import { Document } from "../models";
import { Interactor, InteractorId, InteractorOrderingEntry } from "../working-document";

import { NodeId } from "./nodeId";

export interface EditorState {
  readonly document: Document;

  readonly focusedInteractorId: InteractorId | undefined;
  /**
   * This should only be updated by using the EditorInteractorService.
   */
  readonly interactors: { readonly [id: string /* InteractorId */]: Interactor };
  /**
   * This should only be updated by using the EditorInteractorService.
   */
  readonly interactorOrdering: readonly InteractorOrderingEntry[];

  /**
   * This should only be updated by the EditorNodeTrackingService.
   */
  // This big long object may be a poor fit for immer... not sure what to do about it though
  readonly nodeParentMap: { readonly [id: string /* NodeId */]: NodeId | undefined };
}
