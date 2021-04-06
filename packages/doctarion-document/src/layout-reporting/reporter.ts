import { Chain, Node, NodeNavigator, PathPart } from "../basic-traversal";

import { NodeLayoutProvider } from "./provider";
import { LayoutRect } from "./types";

export class NodeLayoutReporter {
  public constructor(private nodeToProviderLookup: (node: Node) => NodeLayoutProvider | undefined) {}

  public doesLineWrapAfter(nodeNavigator: NodeNavigator): boolean {
    const nav = nodeNavigator.clone();
    const currentLayoutRect = this.getLayout(nav);
    if (nav.navigateToNextSibling()) {
      const nextLayoutRect = this.getLayout(nav);
      if (currentLayoutRect && nextLayoutRect) {
        if (currentLayoutRect?.top < nextLayoutRect?.top && currentLayoutRect.left >= nextLayoutRect?.left) {
          return true;
        }
      }
    }
    return false;
  }

  public doesLineWrapBefore(nodeNavigator: NodeNavigator): boolean {
    const nav = nodeNavigator.clone();
    const currentLayoutRect = this.getLayout(nav);
    if (nav.navigateToPrecedingSibling()) {
      const priorLayoutRect = this.getLayout(nav);
      if (currentLayoutRect && priorLayoutRect) {
        if (currentLayoutRect?.top > priorLayoutRect?.top && currentLayoutRect.left <= priorLayoutRect?.left) {
          return true;
        }
      }
    }
    return false;
  }

  public getLayout(nodeNavigator: NodeNavigator): LayoutRect | undefined {
    const tip = nodeNavigator.tip;
    let nodeWithProvider = tip.node;
    const isCodePoint = Node.isCodePoint(nodeWithProvider);

    if (isCodePoint) {
      const parent = Chain.getParentIfPossible(nodeNavigator.chain);
      if (!parent) {
        return undefined;
      }
      nodeWithProvider = parent.node;
    }

    const provider = this.nodeToProviderLookup(nodeWithProvider);
    if (!provider) {
      return undefined;
    }

    if (isCodePoint) {
      if (!tip.pathPart) {
        return undefined;
      }
      const cpIndex = PathPart.getIndex(tip.pathPart);
      const cp = provider.getCodePointLayout(cpIndex, cpIndex);
      if (cp?.length === 1) {
        return cp[0];
      }
      return undefined;
    } else {
      return provider.getLayout();
    }
  }
}
