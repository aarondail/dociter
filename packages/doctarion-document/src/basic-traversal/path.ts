import { immerable } from "immer";
import lodash from "lodash";

import { SimpleComparison } from "../miscUtils";

import { PathPart } from "./pathPart";

// -----------------------------------------------------------------------------
// This file defines Path types and functions which are used to locate Nodes in
// a Document.
// -----------------------------------------------------------------------------

export type PathString = string;

export class Path {
  [immerable] = true;

  public constructor(public readonly parts: readonly PathPart[]) {}

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
        return PathComparison.Descendent;
      } else if (!b) {
        return PathComparison.Ancestor;
      } else if (a.equalTo(b)) {
        continue;
      } else {
        const aIndex = a.index;
        const bIndex = b.index;
        if (i < maxLen - 1) {
          // OK we are still in the middle of the paths
          // This also covers the cases where the two paths have unequal lengths
          return aIndex < bIndex ? PathComparison.EarlierBranch : PathComparison.LaterBranch;
        } else {
          // Same length and we must be at the end
          return aIndex < bIndex ? PathComparison.EarlierSibling : PathComparison.LaterSibling;
        }
      }
    }
    return PathComparison.Equal;
  }

  compareToSimple(other: Path): SimpleComparison {
    const detailedComparisong = this.compareTo(other);
    switch (detailedComparisong) {
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
        return SimpleComparison.Before;
      case PathComparison.Incomparable:
        return SimpleComparison.Incomparable;
    }
  }

  public equalTo(other: Path): boolean {
    return lodash.isEqual(this.parts, other.parts);
  }

  // replaceParent(path: Path, fn: (label: PathPartLabel, index: number) => PathPart): Path {
  //   if (path.length <= 1) {
  //     return path;
  //   }
  //   const newPath = [...path];
  //   const parent = newPath[newPath.length - 2];
  //   newPath[newPath.length - 2] = fn(parent[0], parent[1]);
  //   return newPath;
  // },

  public replaceTip(newTip: PathPart): Path {
    if (this.parts.length <= 1) {
      return this;
    }
    const newParts = [...this.parts];
    newParts[newParts.length - 1] = newTip;
    return new Path(newParts);
  }

  public toString(): string {
    return this.parts.map((p) => p.toString()).join("/");
  }

  public static parse(s: PathString): Path {
    if (s === "") {
      return new Path([]);
    }
    const parts = s.split("/");
    return new Path(
      parts.map((p) => {
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
