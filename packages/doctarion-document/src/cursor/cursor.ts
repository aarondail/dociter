import { immerable } from "immer";

import { Path } from "../basic-traversal";
import { SimpleComparison } from "../miscUtils";

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

  /**
   * This compares two Cursors. It returns before if this Cursor comes before
   * the other one in the way the cursors move thorugh a Document. It returns equal
   * if both Cursors are exactly the same, and After otherwise.
   */
  public compareTo(other: Cursor): SimpleComparison {
    const pathComparison = this.path.compareToSimple(other.path);
    if (pathComparison === SimpleComparison.Equal) {
      if (this.orientation === CursorOrientation.Before) {
        if (other.orientation === CursorOrientation.Before) {
          return SimpleComparison.Equal;
        }
        return SimpleComparison.After;
      } else if (this.orientation === CursorOrientation.On) {
        if (other.orientation === CursorOrientation.Before) {
          return SimpleComparison.Before;
        } else if (other.orientation === CursorOrientation.After) {
          return SimpleComparison.After;
        }
        return SimpleComparison.Equal;
      } else {
        if (other.orientation === CursorOrientation.After) {
          return SimpleComparison.Equal;
        }
        return SimpleComparison.Before;
      }
    }
    return pathComparison;
  }
}
