import { Cursor } from "../cursor";
import { HorizontalAnchor } from "../layout-reporting";
import { Document } from "../models";
import { Range } from "../ranges";

import { NodeId } from "./nodeId";

export enum SelectionAnchor {
  Start = "START",
  End = "END",
}

export interface EditorState {
  readonly document: Document;
  readonly cursor: Cursor;
  /**
   * Note if there is a selection the cursor should be at one of the two ends.
   */
  readonly selection?: Range;
  readonly selectionAnchor?: SelectionAnchor;

  /**
   * When moving between lines visually, this value stores cursor's x value at
   * the start of the line movement, so we can intelligently move between lines
   * of different length and have the cursor try to go to the right spot.
   */
  readonly cursorVisualLineMovementHorizontalAnchor?: HorizontalAnchor;

  // This big long object may be a poor fit for immer... not sure what to do about it though
  readonly nodeParentMap: { readonly [id: string /* NodeId */]: NodeId | undefined };
}
