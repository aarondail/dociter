import { Node } from "../document-model-rd5";
import { FancyGrapheme, Grapheme } from "../text-model-rd4";

export type PseudoNode<NodeClass extends Node = Node> = NodeClass | FancyGrapheme;

export const PseudoNode = {
  getChildren<NodeClass extends Node>(node: PseudoNode<NodeClass>): readonly PseudoNode<NodeClass>[] | undefined {
    if (node instanceof Node) {
      return node.children as PseudoNode<NodeClass>[];
    }
    return undefined;
  },

  isGraphemeOrFancyGrapheme(node: PseudoNode<any>): node is Grapheme {
    return !(node instanceof Node);
  },

  isNode<NodeClass extends Node>(node: PseudoNode<NodeClass>): node is NodeClass {
    return node instanceof Node;
  },
};
