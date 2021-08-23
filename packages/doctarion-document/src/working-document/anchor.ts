import { immerable } from "immer";

import { InteractorId } from "./interactor";
import { NodeId } from "./nodeAssociatedData";

export type AnchorId = string;

/**
 * Anchors can be placed on nodes, but also before and after them. Before and
 * after meaning between this node and its preceding sibling (if any), or after
 * this node and its following sibling.
 */
export enum AnchorOrientation {
  Before = "BEFORE",
  After = "AFTER",
  On = "ON",
}

export interface AnchorPosition {
  readonly nodeId: NodeId;
  readonly orientation: AnchorOrientation;
  readonly graphemeIndex?: number;
}

/**
 * An Anchor is very similar to a Cursor, but instead of being composed of a
 * path and an orientation it is composed of a NodeId, a possible grapheme index
 * (only used for Graphemes), and an orientation.
 *
 * It can be converted to and from a Cursor as needed, but this form makes it
 * much easier to insert and delete nodes in the Document because existing
 * anchors (contained by interactors) do not need to be updated (generally).
 */
export class Anchor implements AnchorPosition {
  [immerable] = true;

  public constructor(
    public readonly id: string,
    public readonly nodeId: NodeId,
    public readonly orientation: AnchorOrientation,
    public readonly graphemeIndex?: number,
    public readonly name?: string,
    public readonly relatedInteractorId?: InteractorId
  ) {}
}
