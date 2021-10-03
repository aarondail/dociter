import { Node } from "../document-model-rd4";
import { FancyGrapheme } from "../text-model-rd4";

import { PseudoNode } from "./pseudoNode";

export const PseudoNodeUtils = {
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
