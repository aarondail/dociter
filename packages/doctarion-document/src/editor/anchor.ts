import { immerable } from "immer";

import { CursorOrientation } from "../cursor";
import { NodeId } from "../working-document";

/**
 * An Anchor is very similar to a Cursor, but instead of being composed of a path and an orientation it
 * is composed of a NodeId, a possible grapheme index (only used for Graphemes), and an orientation.
 *
 * It can be converted to and from a Cursor as needed, but this form makes it much easier to insert
 * and delete nodes in the Document because existing anchors (contained by interactors) do not need
 * to be updated (generally).
 */
export class Anchor {
  [immerable] = true;

  public constructor(
    public readonly nodeId: NodeId,
    public readonly orientation: CursorOrientation,
    public readonly graphemeIndex?: number
  ) {}
}
