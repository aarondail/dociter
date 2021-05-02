import { immerable } from "immer";

import { Path } from "../basic-traversal";

/**
 * This describes where operations should insert or delete things relative to
 * the cursor position. Neutral is only used when the cursor is on an empty
 * insertion point, which is an empty object that can have children but doesn't
 * currently.
 */
export enum CursorAffinity {
  Before = "BEFORE",
  After = "AFTER",
  Neutral = "NEUTRAL",
}

export class Cursor {
  [immerable] = true;

  public constructor(public readonly at: Path, public readonly affinity: CursorAffinity = CursorAffinity.Before) {}
}
