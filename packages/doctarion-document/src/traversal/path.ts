import lodash from "lodash";

import { SimpleComparison } from "../shared-utils";

import { PathPart } from "./pathPart";

// -----------------------------------------------------------------------------
// This file defines the Path class which can be used to locate Nodes in a
// Document.
//
// Paths are ordered such that children come after parents and before siblings,
// and siblings are ordered based on their index.
// -----------------------------------------------------------------------------

export type PathString = string;

export enum PathAdjustmentDueToMoveReason {
  NoChangeBecauseOldPrefixDoesntMatch = "NO_CHANGE_BECAUSE_OLD_PREFIX_DOESNT_MATCH",
}

export enum PathAdjustmentDueToRelativeDeletionNoChangeReason {
  NoChangeBecauseEqual = "NO_CHANGE_BECAUSE_EQUAL",
  NoChangeBecauseAncestor = "NO_CHANGE_BECAUSE_ANCESTOR",
  NoChangeBecauseDescendant = "NO_CHANGE_BECAUSE_DESCENDANT",
  NoChangeForAnyOtherReason = "NO_CHANGE_FOR_ANY_OTHER_REASON",
}

export enum PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason {
  NoChangeBecauseDescendant = "NO_CHANGE_BECAUSE_DESCENDANT",
  NoChangeForAnyOtherReason = "NO_CHANGE_FOR_ANY_OTHER_REASON",
}

export class Path {
  public readonly parts: readonly PathPart[];

  public constructor(...parts: readonly PathPart[]) {
    this.parts = parts;
  }

  public adjustDueToMove(
    oldPrefix: Path,
    newPrefix: Path,
    indexOffsetUnderPrefix: number
  ): PathAdjustmentDueToMoveReason | Path {
    const [left, right] = this.split(oldPrefix.parts.length);
    if (!left.equalTo(oldPrefix)) {
      return PathAdjustmentDueToMoveReason.NoChangeBecauseOldPrefixDoesntMatch;
    }

    const [connectivePart, reallyRight] = right.split(1);

    if (connectivePart.parts.length === 0) {
      return newPrefix;
    }

    const updatedConnectivePart = connectivePart.parts[0].adjustIndex(indexOffsetUnderPrefix);
    return new Path(...newPrefix.parts, updatedConnectivePart, ...reallyRight.parts);
  }

  /**
   * This adjusts this path to account for a deletion of a different path
   * (passed in).
   */
  public adjustDueToRelativeDeletionAt(at: Path): PathAdjustmentDueToRelativeDeletionNoChangeReason | Path {
    if (at.parts.length === 0) {
      return this.parts.length > 0
        ? PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeBecauseAncestor
        : PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeBecauseEqual;
    }

    for (let i = 0; i < at.parts.length; i++) {
      const a = this.parts[i];
      const b = at.parts[i];

      if (!a) {
        return PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeBecauseDescendant;
      }

      const atTarget = i === at.parts.length - 1;
      const cmp = b.compareTo(a);
      if (atTarget) {
        if (cmp === SimpleComparison.Before) {
          const newParts = [...this.parts];
          newParts[i] = newParts[i].adjustIndex(-1);
          return new Path(...newParts);
        } else if (cmp === SimpleComparison.Equal) {
          if (this.parts.length === at.parts.length) {
            return PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeBecauseEqual;
          } else {
            return PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeBecauseAncestor;
          }
        }
        return PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeForAnyOtherReason;
      } else {
        if (cmp === SimpleComparison.Equal) {
          continue;
        } else {
          return PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeForAnyOtherReason;
        }
      }
    }

    return PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeForAnyOtherReason;
  }

  /**
   * This adjusts this path to account for an insertion at a different path
   * (passed in).
   */
  public adjustDueToRelativeInsertionBefore(at: Path): PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason | Path {
    if (at.parts.length === 0) {
      // One minor change from above algorithm here
      return PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason.NoChangeForAnyOtherReason;
    }

    for (let i = 0; i < at.parts.length; i++) {
      const a = this.parts[i];
      const b = at.parts[i];

      if (!a) {
        return PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason.NoChangeBecauseDescendant;
      }

      const atTarget = i === at.parts.length - 1;
      const cmp = b.compareTo(a);
      if (atTarget) {
        // The check for Equal here is one of two differences from the deletion
        // algorithm above...
        if (cmp === SimpleComparison.Before || cmp === SimpleComparison.Equal) {
          const newParts = [...this.parts];
          // The use of 1 instead of -1 is the other difference from the
          // deletion algorithm above...
          newParts[i] = newParts[i].adjustIndex(1);
          return new Path(...newParts);
        }
        // No updates needed
        return PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason.NoChangeForAnyOtherReason;
      } else {
        if (cmp === SimpleComparison.Equal) {
          continue;
        } else {
          return PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason.NoChangeForAnyOtherReason;
        }
      }
    }

    return PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason.NoChangeForAnyOtherReason;
  }

  public compareTo(other: Path): PathComparison {
    const from = this.parts;
    const to = other.parts;

    if (from.length === 0 && to.length === 0) {
      return PathComparison.Incomparable;
    }
    // We compare the chain from the start until we find a divergence
    const maxLen = Math.max(from.length, to.length);
    for (let i = 0; i < maxLen; i++) {
      // Assume tht for all j < i from[j] equaled to[j]
      const a = from[i];
      const b = to[i];
      if (!a && !b) {
        // This shouldn't happen...
        return PathComparison.Incomparable;
      } else if (!a) {
        return PathComparison.Ancestor;
      } else if (!b) {
        return PathComparison.Descendent;
      } else {
        const cmp = a.compareTo(b);
        if (cmp === SimpleComparison.Equal) {
          continue;
        }

        if (i < maxLen - 1) {
          // OK we are still in the middle of the paths
          // This also covers the cases where the two paths have unequal lengths
          return cmp === SimpleComparison.Before ? PathComparison.EarlierBranch : PathComparison.LaterBranch;
        } else {
          // Same length and we must be at the end
          return cmp === SimpleComparison.Before ? PathComparison.EarlierSibling : PathComparison.LaterSibling;
        }
      }
    }
    return PathComparison.Equal;
  }

  compareToSimple(other: Path): SimpleComparison {
    const detailedComparison = this.compareTo(other);
    switch (detailedComparison) {
      case PathComparison.Equal:
        return SimpleComparison.Equal;
      case PathComparison.Ancestor:
        return SimpleComparison.Before;
      case PathComparison.Descendent:
        return SimpleComparison.After;
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

  public equalTo(other: Path): boolean {
    return lodash.isEqual(this.parts, other.parts);
  }

  public replaceTip(newTip: PathPart): Path {
    if (this.parts.length <= 1) {
      return this;
    }
    const newParts = [...this.parts];
    newParts[newParts.length - 1] = newTip;
    return new Path(...newParts);
  }

  public sliceFromRoot(count: number): Path {
    return new Path(...this.parts.slice(0, count));
  }

  public split(leftLength: number): readonly [Path, Path] {
    return [new Path(...this.parts.slice(0, leftLength)), new Path(...this.parts.slice(leftLength))];
  }

  public toString(): string {
    return this.parts.map((p) => p.toString()).join("/");
  }

  public withoutTip(): Path {
    if (this.parts.length === 0) {
      return this;
    }
    return new Path(...this.parts.slice(0, this.parts.length - 1));
  }

  public static parse(s: PathString): Path {
    if (s === "") {
      return new Path();
    }
    const parts = s.split("/");
    return new Path(
      ...parts.map((p) => {
        return new PathPart(parseInt(p, 10));
      })
    );
  }
}

// -----------------------------------------------------------------------------
// Utility types
// -----------------------------------------------------------------------------

export enum PathComparison {
  Equal = "EQUAL",
  Ancestor = "ANCESTOR",
  Descendent = "DESCENDENT",
  EarlierSibling = "EARLIER_SIBLING",
  LaterSibling = "LATER_SIBLING",
  EarlierBranch = "EARLIER_BRANCH",
  LaterBranch = "LATER_BRANCH",
  Incomparable = "INCOMPARABLE",
}
