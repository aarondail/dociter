import { Node } from "../document-model-rd4";
import { FancyGrapheme } from "../text-model-rd4";

import { PseudoNode } from "./pseudoNode";

export const PseudoNodeUtils = {
  // cloneWithoutContents(node: ObjectNode): ObjectNode {
  //   if (node instanceof Document) {
  //     return new Document(node.title);
  //   } else if (node instanceof HeaderBlock) {
  //     return new HeaderBlock(node.level);
  //   } else if (node instanceof ParagraphBlock) {
  //     return new ParagraphBlock();
  //   } else if (node instanceof InlineText) {
  //     return new InlineText([], node.modifiers);
  //   } else if (node instanceof InlineUrlLink) {
  //     return new InlineUrlLink(node.url, []);
  //   } else if (node instanceof InlineEmoji) {
  //     return new InlineEmoji(node.emojiId);
  //   }
  //   throw new Error("Unknown node type, cannot clone");
  // },

  getChildren(node: PseudoNode): readonly PseudoNode[] | undefined {
    if (node instanceof Node) {
      return node.children;
    }
    return undefined;
  },

  isGrapheme(node: PseudoNode): node is FancyGrapheme {
    return !(node instanceof Node);
  },

  // /**
  //  * Returns true if the node has one or more children.
  //  */
  // hasSomeChildren(node: Node): boolean {
  //   const children = NodeUtils.getChildren(node);
  //   return children ? children.length > 0 : false;
  // },

  // isBlock(node: Node): node is Block {
  //   return node instanceof ParagraphBlock || node instanceof HeaderBlock;
  // },

  // isBlockContainer(node: Node): node is BlockContainingNode {
  //   return node instanceof Document;
  // },

  // isGrapheme(node: Node): node is Grapheme {
  //   return typeof node === "string";
  // },

  // isInline(node: Node): node is Inline {
  //   return node instanceof InlineText || node instanceof InlineUrlLink || node instanceof InlineEmoji;
  // },

  // isInlineContainer(node: Node): node is InlineContainingNode {
  //   // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  //   const k = (node as any).kind;
  //   return k === NodeKind.ParagraphBlock || k === NodeKind.HeaderBlock;
  // },

  // isInlineNonTextContainer(node: Node): boolean {
  //   return node instanceof InlineEmoji;
  // },

  // isInlineText(node: Node): boolean {
  //   // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  //   return (node as any).kind === NodeKind.InlineText;
  // },

  // isObject(node: Node): node is ObjectNode {
  //   return typeof node !== "string";
  // },

  // isTextContainer(node: Node): node is TextContainingNode {
  //   // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  //   const k = (node as any).kind;
  //   return k === NodeKind.InlineText || k === NodeKind.InlineUrlLink;
  // },

  // switch<T>(node: Node, handlers: NodeHandlersForSwitch<T>): T {
  //   if (typeof node === "string") {
  //     return handlers.onGrapheme(node);
  //   } else if (node instanceof HeaderBlock) {
  //     return handlers.onHeaderBlock(node);
  //   } else if (node instanceof ParagraphBlock) {
  //     return handlers.onParagraphBlock(node);
  //   } else if (node instanceof InlineText) {
  //     return handlers.onInlineText(node);
  //   } else if (node instanceof InlineUrlLink) {
  //     return handlers.onInlineUrlLink(node);
  //   } else if (node instanceof InlineEmoji) {
  //     return handlers.onInlineEmoji(node);
  //   } else {
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //     return handlers.onDocument(node as any);
  //   }
  // },
};

// /**
//  * This is just used as the type of one of the parameters in the
//  * Node.switchOnType function. It contains a callback functions for each type
//  * of node.
//  */
// export type NodeHandlersForSwitch<T> = {
//   onDocument: (d: Document) => T;
//   onGrapheme: (s: Grapheme) => T;
//   onHeaderBlock: (b: HeaderBlock) => T;
//   onParagraphBlock: (b: ParagraphBlock) => T;
//   onInlineText: (e: InlineText) => T;
//   onInlineUrlLink: (e: InlineUrlLink) => T;
//   onInlineEmoji: (e: InlineEmoji) => T;
// };
