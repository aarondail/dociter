import * as IterTools from "iter-tools";

import * as Models from "../models";

import { Node } from "./node";

// -----------------------------------------------------------------------------
// This file defines Path types and functions which are used to locate Nodes in
// a Document.
// -----------------------------------------------------------------------------

export type Path = readonly PathPart[];
export enum PathPartLabel {
  Block = "block",
  Content = "content",
  CodePoint = "cp",
}
export type PathPart = readonly [PathPartLabel, number];

export type PathString = string;

export const PathPart = {
  block: (index: number): PathPart => [PathPartLabel.Block, index],

  content: (index: number): PathPart => [PathPartLabel.Content, index],

  codePoint: (index: number): PathPart => [PathPartLabel.CodePoint, index],

  getLabel(pathPart: PathPart): PathPartLabel {
    return pathPart[0];
  },

  getIndex(pathPart: PathPart): number {
    return pathPart[1];
  },

  isEqual(left: PathPart, right: PathPart): boolean {
    return left[0] === right[0] && left[1] === right[1];
  },

  /**
   * Walk (if you will) from the passed node to one of its children as
   * described by the passed path part.
   */
  resolveToChild(parentNode: Node, pathPart: PathPart): Node | undefined {
    // Technically since labels don't factor into the code below we could just call:
    // getChildren()[getIndex(pathPart)]...
    return PathPart.resolve<Node | undefined>(parentNode, pathPart, {
      onDocument: (d, _label, index) => d.blocks[index],
      onHeaderBlock: (b: Models.HeaderBlock, _label, index) => b.content[index],
      onParagraphBlock: (b: Models.ParagraphBlock, _label, index) => b.content[index],
      onInlineText: (e: Models.InlineText, _label, index) => e.text[index],
      onInlineUrlLink: (e: Models.InlineUrlLink, _label, index) => e.text[index],
    });
  },

  resolve<T>(parentNode: Node, pathPart: PathPart, handlers: ResolvePathPartHandlers<T>): T | undefined {
    const resolve = resolvePathPartHelper;

    return Node.switch<T | undefined>(parentNode, {
      onDocument: (d: Models.Document) =>
        resolve(pathPart, PathPartLabel.Block, (idx) => handlers.onDocument(d, PathPartLabel.Block, idx)),
      onCodePoint: () =>
        // There is nothing further we can unpack into here.  There are no "parts" of a CodePoint...
        undefined,
      onHeaderBlock: (b: Models.HeaderBlock) =>
        resolve(pathPart, PathPartLabel.Content, (idx) => handlers.onHeaderBlock(b, PathPartLabel.Content, idx)),
      onParagraphBlock: (b: Models.ParagraphBlock) =>
        resolve(pathPart, PathPartLabel.Content, (idx) => handlers.onParagraphBlock(b, PathPartLabel.Content, idx)),
      onInlineUrlLink: (e: Models.InlineUrlLink) =>
        resolve(pathPart, PathPartLabel.CodePoint, (idx) => handlers.onInlineUrlLink(e, PathPartLabel.CodePoint, idx)),
      onInlineText: (e: Models.InlineText) =>
        resolve(pathPart, PathPartLabel.CodePoint, (idx) => handlers.onInlineText(e, PathPartLabel.CodePoint, idx)),
    });
  },
};

export const Path = {
  compareTo(from: Path, to: Path): PathComparison {
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
      } else if (PathPart.isEqual(a, b)) {
        continue;
      } else {
        const aLabel = PathPart.getLabel(a);
        const aIndex = PathPart.getIndex(a);
        const bLabel = PathPart.getLabel(b);
        const bIndex = PathPart.getIndex(b);
        if (aLabel !== bLabel) {
          // We don't expect this to happen at this point. All Nodes
          // have children where the labels are the same.
          return PathComparison.Incomparable;
        } else if (i < maxLen - 1) {
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
  Equal = "EQUAL",
  Ancestor = "ANCESTOR",
  Descendent = "DESCENDENT",
  EarlierSibling = "EARLIER_SIBLING",
  LaterSibling = "LATER_SIBLING",
  EarlierBranch = "EARLIER_BRANCH",
  LaterBranch = "LATER_BRANCH",
  Incomparable = "INCOMPARABLE",
}

export type ResolvePathPartHandlers<T> = {
  onDocument: (d: Models.Document, pathLabel: PathPartLabel.Block, pathIndex: number) => T;
  onHeaderBlock: (b: Models.HeaderBlock, pathLabel: PathPartLabel.Content, pathIndex: number) => T;
  onParagraphBlock: (b: Models.ParagraphBlock, pathLabel: PathPartLabel.Content, pathIndex: number) => T;
  onInlineText: (e: Models.InlineText, pathLabel: PathPartLabel.CodePoint, pathIndex: number) => T;
  onInlineUrlLink: (e: Models.InlineUrlLink, pathLabel: PathPartLabel.CodePoint, pathIndex: number) => T;
  // Note that code points never have any children so they can't be "walked" into
};

// ----------------------------------------------------------------------------
// PRIVATE UTILITY FUNCTIONS
// ----------------------------------------------------------------------------

function resolvePathPartHelper<T>(
  pathPart: PathPart,
  expectedLabel: string,
  processCallback: (index: number) => T
): T | undefined {
  if (pathPart.length !== 2 || pathPart[0] !== expectedLabel || typeof pathPart[1] !== "number") {
    return undefined;
  }
  const idx = pathPart[1];
  return processCallback(idx);
}
