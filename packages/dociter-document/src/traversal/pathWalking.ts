import * as Models from "../models";

import { Node } from "./node";
import { PathPart, PathPartLabel } from "./path";

// -----------------------------------------------------------------------------
// This file defines Path types and functions which are used to locate Nodes in
// a Document.
// -----------------------------------------------------------------------------

export const PathWalking = {
  /**
   * Walk (if you will) from the passed node to one of its children as
   * described by the passed path part.
   */
  walkToChild(parentNode: Node, pathPart: PathPart): Node | undefined {
    // Technically since labels don't factor into the code below we could just call:
    // getChildren()[getIndex(pathPart)]...
    return PathWalking.walk<Node | undefined>(parentNode, pathPart, {
      onDocument: (d, _label, index) => d.blocks[index],
      onHeaderBlock: (b: Models.HeaderBlock, _label, index) => b.content[index],
      onParagraphBlock: (b: Models.ParagraphBlock, _label, index) => b.content[index],
      onInlineText: (e: Models.InlineText, _label, index) => e.text[index],
      onInlineUrlLink: (e: Models.InlineUrlLink, _label, index) => e.text[index],
    });
  },

  walk<T>(parentNode: Node, pathPart: PathPart, handlers: PathWalkingHandlers<T>): T | undefined {
    const unpack = unpackPathPartHelper;

    return Node.switch<T | undefined>(parentNode, {
      onDocument: (d: Models.Document) =>
        unpack(pathPart, PathPartLabel.BLOCK, (idx) => handlers.onDocument(d, PathPartLabel.BLOCK, idx)),
      onCodePoint: () =>
        // There is nothing further we can unpack into here.  There are no "parts" of a CodePoint...
        undefined,
      onHeaderBlock: (b: Models.HeaderBlock) =>
        unpack(pathPart, PathPartLabel.CONTENT, (idx) => handlers.onHeaderBlock(b, PathPartLabel.CONTENT, idx)),
      onParagraphBlock: (b: Models.ParagraphBlock) =>
        unpack(pathPart, PathPartLabel.CONTENT, (idx) => handlers.onParagraphBlock(b, PathPartLabel.CONTENT, idx)),
      onInlineUrlLink: (e: Models.InlineUrlLink) =>
        unpack(pathPart, PathPartLabel.CODE_POINT, (idx) => handlers.onInlineUrlLink(e, PathPartLabel.CODE_POINT, idx)),
      onInlineText: (e: Models.InlineText) =>
        unpack(pathPart, PathPartLabel.CODE_POINT, (idx) => handlers.onInlineText(e, PathPartLabel.CODE_POINT, idx)),
    });
  },
};

export type PathWalkingHandlers<T> = {
  onDocument: (d: Models.Document, pathLabel: PathPartLabel.BLOCK, pathIndex: number) => T;
  onHeaderBlock: (b: Models.HeaderBlock, pathLabel: PathPartLabel.CONTENT, pathIndex: number) => T;
  onParagraphBlock: (b: Models.ParagraphBlock, pathLabel: PathPartLabel.CONTENT, pathIndex: number) => T;
  onInlineText: (e: Models.InlineText, pathLabel: PathPartLabel.CODE_POINT, pathIndex: number) => T;
  onInlineUrlLink: (e: Models.InlineUrlLink, pathLabel: PathPartLabel.CODE_POINT, pathIndex: number) => T;
  // Note that code points never have any children so they can't be "walked" into
};

// ----------------------------------------------------------------------------
// PRIVATE UTILITY FUNCTIONS
// ----------------------------------------------------------------------------

function unpackPathPartHelper<T>(
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
