import * as IterTools from "iter-tools";

import { Node } from "./node";

// -----------------------------------------------------------------------------
// This file defines Path types and functions which are used to locate Nodes in
// a Document.
// -----------------------------------------------------------------------------

export type Path = readonly PathPart[];
export enum PathPartLabel {
  BLOCK = "block",
  CONTENT = "content",
  CODE_POINT = "cp",
}
export type PathPart = readonly [PathPartLabel, number];

export type PathString = string;

export const PathPart = {
  block: (index: number): PathPart => [PathPartLabel.BLOCK, index],

  content: (index: number): PathPart => [PathPartLabel.CONTENT, index],

  codePoint: (index: number): PathPart => [PathPartLabel.CODE_POINT, index],

  getLabel(pathPart: PathPart): PathPartLabel {
    return pathPart[0];
  },

  getIndex(pathPart: PathPart): number {
    return pathPart[1];
  },

  isEqual(left: PathPart, right: PathPart): boolean {
    return left[0] === right[0] && left[1] === right[1];
  },
};

export const Path = {
  compareTo(from: Path, to: Path): PathComparison {
    if (from.length === 0 && to.length === 0) {
      return PathComparison.CANT_COMPARE;
    }
    // We compare the chain from the start until we find a divergence
    const maxLen = Math.max(from.length, to.length);
    for (let i = 0; i < maxLen; i++) {
      // Assume tht for all j < i from[j] equaled to[j]
      const a = from[i];
      const b = to[i];
      if (!a && !b) {
        // This shouldn't happen...
        return PathComparison.CANT_COMPARE;
      } else if (!a) {
        return PathComparison.DESCENDENT;
      } else if (!b) {
        return PathComparison.ANCESTOR;
      } else if (PathPart.isEqual(a, b)) {
        continue;
      } else {
        const aLabel = PathPart.getLabel(a);
        const aIndex = PathPart.getIndex(a);
        const bLabel = PathPart.getLabel(b);
        const bIndex = PathPart.getIndex(b);
        if (aLabel !== bLabel) {
          // We don't expect this to happen at this point. All Elements
          // have children where the labels are the same.
          return PathComparison.CANT_COMPARE;
        } else if (i < maxLen - 1) {
          // OK we are still in the middle of the paths
          // This also covers the cases where the two paths have unequal lengths
          return aIndex < bIndex ? PathComparison.EARLIER_BRANCH : PathComparison.LATER_BRANCH;
        } else {
          // Same length and we must be at the end
          return aIndex < bIndex ? PathComparison.EARLIER_SIBLING : PathComparison.LATER_SIBLING;
        }
      }
    }
    return PathComparison.EQUAL;
  },

  isEqual(left: Path, right: Path): boolean {
    return IterTools.deepEqual(left, right);
  },

  parse(s: PathString): Path {
    if (s === "") {
      return [];
    }
    const parts = s.split("/");
    return parts.map((p) => {
      const subParts = p.split(":");
      return ([subParts[0], parseInt(subParts[1], 10)] as unknown) as PathPart;
    });
  },

  replaceParent(path: Path, fn: (label: PathPartLabel, index: number) => PathPart): Path {
    if (path.length <= 1) {
      return path;
    }
    const newPath = [...path];
    const parent = newPath[newPath.length - 2];
    newPath[newPath.length - 2] = fn(parent[0], parent[1]);
    return newPath;
  },

  replaceTip(path: Path, fn: (label: PathPartLabel, index: number) => PathPart): Path {
    if (path.length <= 1) {
      return path;
    }
    const newPath = [...path];
    const tip = newPath[newPath.length - 1];
    newPath[newPath.length - 1] = fn(tip[0], tip[1]);
    return newPath;
  },

  toString(path: Path): string {
    return path.map((p) => `${p[0]}:${p[1]}`).join("/");
  },
};

export enum PathComparison {
  EQUAL = "EQUAL",
  ANCESTOR = "ANCESTOR",
  DESCENDENT = "DESCENDENT",
  EARLIER_SIBLING = "EARLIER_SIBLING",
  LATER_SIBLING = "LATER_SIBLING",
  EARLIER_BRANCH = "EARLIER_BRANCH",
  LATER_BRANCH = "LATER_BRANCH",
  CANT_COMPARE = "CANT_COMPARE",
}
