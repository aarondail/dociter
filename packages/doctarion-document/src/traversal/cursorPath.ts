import { AnchorOrientation } from "../document-model";
import { SimpleComparison } from "../shared-utils";

import {
  Path,
  PathAdjustmentDueToMoveReason,
  PathAdjustmentDueToRelativeDeletionNoChangeReason,
  PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason,
  PathComparison,
} from "./path";

export type CursorOrientation = AnchorOrientation;
export const CursorOrientation = AnchorOrientation;

/**
 * Cursors can be placed on nodes, but also before and after them. Before and
 * after meaning between this node and its preceding sibling (if any), or after
 * this node and its following sibling.
 *
 * They are very similar to Anchors, but instead of referencing a Node they have
 * a Path to a node.
 */
export class CursorPath {
  public constructor(public readonly path: Path, public readonly orientation: CursorOrientation) {}

  public adjustDueToMove(
    oldPrefix: Path,
    newPrefix: Path,
    indexOffsetUnderPrefix: number
  ): CursorPath | PathAdjustmentDueToMoveReason {
    const pathOrReason = this.path.adjustDueToMove(oldPrefix, newPrefix, indexOffsetUnderPrefix);
    if (pathOrReason instanceof Path) {
      return new CursorPath(pathOrReason, this.orientation);
    }
    return pathOrReason;
  }

  /**
   * This adjusts the path to account for a deletion of a different path (passed
   * in).
   */
  public adjustDueToRelativeDeletionAt(at: Path): CursorPath | PathAdjustmentDueToRelativeDeletionNoChangeReason {
    const pathOrReason = this.path.adjustDueToRelativeDeletionAt(at);
    if (pathOrReason instanceof Path) {
      return new CursorPath(pathOrReason, this.orientation);
    }
    return pathOrReason;
  }

  /**
   * This adjusts this cursor's path to account for an insertion at a different
   * path (passed in).
   */
  public adjustDueToRelativeInsertionBefore(
    at: Path
  ): CursorPath | PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason {
    const pathOrReason = this.path.adjustDueToRelativeInsertionBefore(at);
    if (pathOrReason instanceof Path) {
      return new CursorPath(pathOrReason, this.orientation);
    }
    return pathOrReason;
  }

  /**
   * This compares two Cursors. It returns before if this Cursor comes before
   * the other one in the way the cursors move thorough a Document. It returns equal
   * if both Cursors are exactly the same, and After otherwise.
   */
  public compareTo(other: CursorPath): SimpleComparison {
    switch (this.path.compareTo(other.path)) {
      case PathComparison.Equal:
        if (this.orientation === CursorOrientation.Before) {
          if (other.orientation === CursorOrientation.Before) {
            return SimpleComparison.Equal;
          }
          return SimpleComparison.Before;
        } else if (this.orientation === CursorOrientation.On) {
          if (other.orientation === CursorOrientation.Before) {
            return SimpleComparison.After;
          } else if (other.orientation === CursorOrientation.After) {
            return SimpleComparison.Before;
          }
          return SimpleComparison.Equal;
        } else {
          if (other.orientation === CursorOrientation.After) {
            return SimpleComparison.Equal;
          }
          return SimpleComparison.After;
        }
      case PathComparison.Ancestor:
        if (this.orientation === CursorOrientation.After) {
          return SimpleComparison.After;
        } else {
          return SimpleComparison.Before;
        }
      case PathComparison.Descendent:
        if (other.orientation === CursorOrientation.After) {
          return SimpleComparison.Before;
        } else {
          return SimpleComparison.After;
        }
      case PathComparison.EarlierSibling:
        return SimpleComparison.Before;
      case PathComparison.LaterSibling:
        return SimpleComparison.After;
      case PathComparison.EarlierBranch:
        return SimpleComparison.Before;
      case PathComparison.LaterBranch:
        return SimpleComparison.After;
      case PathComparison.Incomparable:
        return SimpleComparison.Incomparable;
    }
  }

  public toString(): string {
    return `${this.orientation} ${this.path.toString()}`;
  }
}
