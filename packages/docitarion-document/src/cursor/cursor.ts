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

export interface Cursor {
  readonly at: Path;
  readonly affinity: CursorAffinity;
}

export const Cursor = {
  new(at: Path, affinity: CursorAffinity = CursorAffinity.Before): Cursor {
    return {
      at,
      affinity,
    };
  },
};
