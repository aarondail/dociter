import { Node } from "../document-model-rd4";
import { FancyGrapheme, Grapheme } from "../text-model-rd4";

export type PseudoNode<NodeType extends Node = Node> = NodeType | FancyGrapheme;

export const PseudoNode = {
  getChildren<NodeType extends Node>(node: PseudoNode<NodeType>): readonly PseudoNode<NodeType>[] | undefined {
    if (node instanceof Node) {
      return node.children as PseudoNode<NodeType>[];
    }
    return undefined;
  },

  isGraphemeOrFancyGrapheme(node: PseudoNode<any>): node is Grapheme {
    return !(node instanceof Node);
  },
};
