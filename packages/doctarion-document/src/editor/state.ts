import { InteractorSet } from "../interactor";
import { Document } from "../models";

import { NodeId } from "./nodeId";

export interface EditorState {
  readonly document: Document;
  readonly interactors: InteractorSet;

  /**
   * This should only be updated by the EditorNodeTrackingService.
   */
  // This big long object may be a poor fit for immer... not sure what to do about it though
  readonly nodeParentMap: { readonly [id: string /* NodeId */]: NodeId | undefined };
}
