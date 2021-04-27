import { Grapheme } from "./grapheme";
import { Text } from "./text";

// -----------------------------------------------------------------------------
// You can think of a document as a tree like structure of Nodes. The Nodes
// are just the different objects that make up the Document.
//
// This is very handy for traversal.
//
// Nodes, with the exception of graphemes, can also be assigned ids to make it
// easier to track them.
// -----------------------------------------------------------------------------

export enum NodeKind {
  Document = "DOCUMENT",
  ParagraphBlock = "PARAGRAPH",
  HeaderBlock = "HEADER",
  InlineText = "TEXT",
  InlineUrlLink = "URL_LINK",
  Grapheme = "GRAPHEME",
}

export enum NodeLayoutType {
  Block = "BLOCK",
  Inline = "INLINE",
}

export type Node = ObjectNode | Grapheme;

/**
 * All document nodes are ObjectNodes except for Graphemes.
 */
export abstract class ObjectNode {
  public abstract children?: readonly Node[];
  public abstract kind: Omit<NodeKind, NodeKind.Grapheme>;
  public abstract layoutType: NodeLayoutType;
}
