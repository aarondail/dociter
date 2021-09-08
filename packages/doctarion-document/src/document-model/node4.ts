import { immerable } from "immer";

import { Grapheme } from "./grapheme";

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
  InlineEmoji = "EMOJI",
  InlineText = "TEXT",
  InlineUrlLink = "URL_LINK",
  Grapheme = "GRAPHEME",
}

export enum NodeLayoutType {
  Block = "BLOCK",
  Inline = "INLINE",
}

interface Emoji {}

interface Symbol {}

type CharacterLike = Grapheme | Emoji | Symbol;

enum SimpleAttributeType {
  EnumWithOptions,
  Boolean,
  Trinary,
}

export type MetaNode = ObjectNode | CharacterLike;

export class NodeType {
  kind: NodeKind;
  childrenType: "FancyText" | "Text" | "Void" | "Inlines" | "Blocks" | "Specialized";
  specializedChildType?: NodeKind;
  mainType: NodeLayoutType;
  attributes: Map<string, NodeType | SimpleAttributeType>;
}
/**
 * All document nodes are ObjectNodes except for Graphemes.
 */
// export abstract class ObjectNode {
//   [immerable] = true;
//   public abstract children?: readonly Node[];
//   public abstract kind: Omit<NodeKind, NodeKind.Grapheme>;
//   public abstract layoutType: NodeLayoutType;
// }

// TODO I still think I want classes
export abstract class Node {
  //...
}

// TODO readonly/writable

// export class WorkingNode<T> extends T {
//   id;
//   parent;
//   version;
//   events: {
//     childAdded: () => void;
//     childRemoved: () => void;
//     childReordered: () => void;
//     textUpdated: () => void;
//   };
//   theNode;
// }

// export class WorkingNode {
//   id;
//   parent;
//   version;
//   events: {
//     childAdded: () => void;
//     childRemoved: () => void;
//     childReordered: () => void;
//     textUpdated: () => void;
//   };
//   theNode;
// }
