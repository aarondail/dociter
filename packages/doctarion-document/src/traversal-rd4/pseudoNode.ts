import { Node } from "../document-model-rd4";
import { FancyGrapheme, Grapheme } from "../text-model-rd4";

export type PseudoNode = Node | FancyGrapheme;

export const PseudoNode = {
  getChildren(node: PseudoNode): readonly PseudoNode[] | undefined {
    if (node instanceof Node) {
      return node.children;
    }
    return undefined;
  },

  isGraphemeOrFancyGrapheme(node: PseudoNode): node is Grapheme {
    return !(node instanceof Node);
  },
};
