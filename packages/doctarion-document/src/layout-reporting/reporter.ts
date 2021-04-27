import { Chain, NodeNavigator, PathPart } from "../basic-traversal";
import { Node, NodeUtils } from "../models";

import { NodeLayoutProvider } from "./provider";
import { LayoutRect } from "./rect";

export class NodeLayoutReporter {
  public constructor(private nodeToProviderLookup: (node: Node) => NodeLayoutProvider | undefined) {}

  public doesFollowingRectWrapToNewLine(rect: LayoutRect, followingRect: LayoutRect): boolean {
    return followingRect.left < rect.left || (followingRect.left === rect.left && followingRect.top > rect.top);
  }

  public doesLineWrapAfter(nodeNavigator: NodeNavigator): boolean {
    const nav = nodeNavigator.clone();
    const currentLayoutRect = this.getLayout(nav);
    if (nav.navigateToNextSibling()) {
      const nextLayoutRect = this.getLayout(nav);
      if (currentLayoutRect && nextLayoutRect) {
        if (this.doesFollowingRectWrapToNewLine(currentLayoutRect, nextLayoutRect)) {
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
        if (this.doesPreceedingRectWrapToNewLine(currentLayoutRect, priorLayoutRect)) {
          return true;
        }
      }
    }
    return false;
  }

  public doesPreceedingRectWrapToNewLine(rect: LayoutRect, preceedingRect: LayoutRect): boolean {
    return preceedingRect.right > rect.right || (preceedingRect.right === rect.right && preceedingRect.top < rect.top);
  }

  public getLayout(at: NodeNavigator | Chain): LayoutRect | undefined {
    const chain: Chain = at instanceof NodeNavigator ? at.chain : at;
    const tip = Chain.getTip(chain);
    let nodeWithProvider = tip.node;
    const isGrapheme = NodeUtils.isGrapheme(nodeWithProvider);

    if (isGrapheme) {
      const parent = Chain.getParentIfPossible(chain);
      if (!parent) {
        return undefined;
      }
      nodeWithProvider = parent.node;
    }

    const provider = this.nodeToProviderLookup(nodeWithProvider);
    if (!provider) {
      return undefined;
    }

    if (isGrapheme) {
      if (!tip.pathPart) {
        return undefined;
      }
      const gIndex = PathPart.getIndex(tip.pathPart);
      const g = provider.getGraphemeLayout(gIndex, gIndex);
      if (g) {
        return g[0];
      }
      return undefined;
    } else {
      return provider.getLayout();
    }
  }
}
