import { Node } from "../document-model-rd4";
import { FancyGrapheme } from "../text-model-rd4";

export type PseudoNode = Node | FancyGrapheme;

export const PseudoNode = {
  getChildren(node: PseudoNode): readonly PseudoNode[] | undefined {
    if (node instanceof Node) {
      return node.children;
    }
    return undefined;
  },

  isGrapheme(node: PseudoNode): node is FancyGrapheme {
    return !(node instanceof Node);
  },
};
