/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as Models from "../models";

import { NodeId, nodeIdSymbol } from "./nodeId";

// -----------------------------------------------------------------------------
// You can think of a document as a tree like structure of Nodes. The Nodes
// are just the different objects that make up the Document.
//
// This is very handy for traversal.
//
// Nodes, with the exception of code points, can also be assigned ids to make it
// easier to track them.
// -----------------------------------------------------------------------------

export type Node = Models.Block | Models.Inline | Models.CodePoint | Models.Document;

export const Node = {
  /**
   * Assigns an id to this node. Note that code points cannot be assigned ids.
   */
  assignId(node: Node, id: NodeId): void {
    if (typeof node === "string") {
      throw new Error("Cannot assign a node id to code points.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (node as any)[nodeIdSymbol] = id;
  },

  getChildren(node: Node): readonly Node[] | undefined {
    return Node.switch<readonly Node[] | undefined>(node, {
      onDocument: (d) => d.blocks,
      onHeaderBlock: (b: Models.HeaderBlock) => b.content,
      onParagraphBlock: (b: Models.ParagraphBlock) => b.content,
      onInlineText: (e: Models.InlineText) => e.text,
      onInlineUrlLink: (e: Models.InlineUrlLink) => e.text,
      onCodePoint: () => undefined,
    });
  },

  /**
   * This gets the id _previously assigned_ to this node (via `assignId`). Also
   * note that code points cannot have node ids.
   */
  getId(node: Node): NodeId | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
    return (node as any)[nodeIdSymbol];
  },

  hasChildren(node: Node): boolean {
    const children = Node.getChildren(node);
    return children ? children.length > 0 : false;
  },

  isBlock(node: Node): node is Models.Block {
    return Node.isHeaderBlock(node) || Node.isParagraphBlock(node);
  },

  isCodePoint(node: Node): boolean {
    return typeof node === "string";
  },

  isDocument(node: Node): node is Models.Document {
    return (node as any).kind === undefined && typeof node !== "string";
  },

  isHeaderBlock(node: Node): node is Models.HeaderBlock {
    return (node as any).kind === Models.BlockKind.Header;
  },

  isInline(node: Node): node is Models.Document {
    return Node.isInlineText(node) || Node.isInlineUrlLink(node);
  },

  isInlineText(node: Node): node is Models.InlineText {
    return (node as any).kind === Models.InlineKind.Text;
  },

  isInlineUrlLink(node: Node): node is Models.InlineUrlLink {
    return (node as any).kind === Models.InlineKind.UrlLink;
  },

  isParagraphBlock(node: Node): node is Models.ParagraphBlock {
    return (node as any).kind === Models.BlockKind.Paragraph;
  },

  containsText(node: Node): node is NodeThatContainsText {
    const k: unknown = (node as any).kind;
    return k === Models.InlineKind.Text || k === Models.InlineKind.UrlLink;
  },

  containsInlineContent(node: Node): node is NodeThatContainsInlineContent {
    const k: unknown = (node as any).kind;
    return k === Models.BlockKind.Header || k === Models.BlockKind.Paragraph;
  },

  switch<T>(node: Node, handlers: NodeHandlersForSwitch<T>): T {
    const k: unknown = (node as any).kind;
    if (typeof node === "string") {
      return handlers.onCodePoint(node);
    } else if (k === Models.BlockKind.Header) {
      return handlers.onHeaderBlock(node as any);
    } else if (k === Models.BlockKind.Paragraph) {
      return handlers.onParagraphBlock(node as any);
    } else if (k === Models.InlineKind.Text) {
      return handlers.onInlineText(node as any);
    } else if (k === Models.InlineKind.UrlLink) {
      return handlers.onInlineUrlLink(node as any);
    } else {
      return handlers.onDocument(node as any);
    }
  },
};

/**
 * This is just used as the type of one of the parameters in the
 * Node.switchOnType function. It contains a callback functions for each type
 * of node.
 */
export type NodeHandlersForSwitch<T> = {
  onDocument: (d: Models.Document) => T;
  onCodePoint: (s: Models.CodePoint) => T;
  onHeaderBlock: (b: Models.HeaderBlock) => T;
  onParagraphBlock: (b: Models.ParagraphBlock) => T;
  onInlineText: (e: Models.InlineText) => T;
  onInlineUrlLink: (e: Models.InlineUrlLink) => T;
};

/**
 * Helper type that lists the Node types that have text / code points.
 */
export type NodeThatContainsText = Models.InlineText | Models.InlineUrlLink;

/**
 * Helper type that lists the Node types that can have Inlines in their content
 * property.
 */
export type NodeThatContainsInlineContent = Models.HeaderBlock | Models.ParagraphBlock;
