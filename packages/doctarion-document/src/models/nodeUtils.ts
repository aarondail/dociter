import { HeaderBlock, InlineContainingNode, ParagraphBlock } from "./blocks";
import { Document } from "./document";
import { Grapheme } from "./grapheme";
import { Inline, InlineText, InlineUrlLink, TextContainingNode } from "./inlines";
import { Node, NodeKind, ObjectNode } from "./node";

export const NodeUtils = {
  /**
   * Helper that makes it easier to work with Nodes which may have a children
   * property, or, in the case of Grapheme's do not.
   */
  getChildren(node: Node): readonly Node[] | undefined {
    if (typeof node === "string") {
      return undefined;
    }
    return node.children;
  },

  /**
   * Returns true if the node has one or more children.
   */
  hasChildren(node: Node): boolean {
    const children = NodeUtils.getChildren(node);
    return children ? children.length > 0 : false;
  },

  isGrapheme(node: Node): node is Grapheme {
    return typeof node === "string";
  },

  isInline(node: Node): node is Inline {
    return node instanceof InlineText || node instanceof InlineUrlLink;
  },

  isInlineContainer(node: Node): node is InlineContainingNode {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const k = (node as any).kind;
    return k === NodeKind.ParagraphBlock || k === NodeKind.HeaderBlock;
  },

  isObject(node: Node): node is ObjectNode {
    return typeof node !== "string";
  },

  isTextContainer(node: Node): node is TextContainingNode {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const k = (node as any).kind;
    return k === NodeKind.InlineText || k === NodeKind.InlineUrlLink;
  },

  switch<T>(node: Node, handlers: NodeHandlersForSwitch<T>): T {
    if (typeof node === "string") {
      return handlers.onGrapheme(node);
    } else if (node instanceof HeaderBlock) {
      return handlers.onHeaderBlock(node);
    } else if (node instanceof ParagraphBlock) {
      return handlers.onParagraphBlock(node);
    } else if (node instanceof InlineText) {
      return handlers.onInlineText(node);
    } else if (node instanceof InlineUrlLink) {
      return handlers.onInlineUrlLink(node);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  onDocument: (d: Document) => T;
  onGrapheme: (s: Grapheme) => T;
  onHeaderBlock: (b: HeaderBlock) => T;
  onParagraphBlock: (b: ParagraphBlock) => T;
  onInlineText: (e: InlineText) => T;
  onInlineUrlLink: (e: InlineUrlLink) => T;
};
