import { immerable } from "immer";

import { Path } from "../basic-traversal";

/**
 * Cursors can be placed on nodes, but also before and after them. Before and
 * after meaning between this node and its preceeding sibling (if any), or after
 * this node and its following sibling.
 */
export enum CursorOrientation {
  Before = "BEFORE",
  After = "AFTER",
  On = "ON",
}

export class Cursor {
  [immerable] = true;

  public constructor(public readonly path: Path, public readonly orientation: CursorOrientation) {}
}
