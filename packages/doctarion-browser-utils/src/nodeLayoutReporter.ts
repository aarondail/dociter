import {
  Chain,
  EditorEvents,
  HorizontalAnchor,
  Node,
  NodeLayoutReporter as NodeLayoutReporterInterface,
  NodeNavigator,
  NodeUtils,
  Side,
} from "doctarion-document";
import memoizee from "memoizee/weak";

import { NodeLayoutProvider } from "./nodeLayoutProvider";
import { NodeLayoutProviderRegistry } from "./nodeLayoutProviderRegistry";
import { NodeTextLayoutAnalyzer } from "./nodeTextLayoutAnalyzer";
import { NodeGraphemeInfo, areRectsOnSameLine, buildGraphemeToCodeUnitMap, buildNodeGraphemeInfo } from "./utils";

export class NodeLayoutReporter implements NodeLayoutReporterInterface {
  private getNodeGraphemeInfo: ((node: Node) => NodeGraphemeInfo | null) &
    memoizee.Memoized<(node: Node) => NodeGraphemeInfo | null>;

  /**
   * This is cleared whenever a document update finishes.  So any analyzers
   * added to it have a very short lifetime and can expect that both the
   * document and HTML rendered for the document are constant.
   *
   * Note that if this was to be preserved over the course of document updates,
   * since Nodes are immutable, we'd probably want to index this by NodeId
   * rather than Node.
   */
  private temporaryNodeTextLayoutAnalyzers: Map<Node, NodeTextLayoutAnalyzer>;

  public constructor(private readonly registry: NodeLayoutProviderRegistry, private readonly events: EditorEvents) {
    // This weakly holds onto a reference to the node
    this.getNodeGraphemeInfo = memoizee((node: Node) => {
      if (NodeUtils.isTextContainer(node)) {
        return buildNodeGraphemeInfo(node);
      }
      return null;
    }, {});

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.temporaryNodeTextLayoutAnalyzers = new Map();

    this.events.updateDone.addListener(this.clearPerUpdateCachedInfo);
  }

  public detectHorizontalDistanceFromTargetHorizontalAnchor(
    subject: NodeNavigator | Chain,
    subjectSide: Side,
    target: HorizontalAnchor
  ):
    | { distance: number; estimatedSubjectSiblingsToTarget?: number; estimatedSubjectSiblingSideClosestToTarget?: Side }
    | undefined {
    let estimatedSubjectSiblingsToTarget = undefined;
    let estimatedSubjectSiblingSideClosestToTarget = undefined;
    if (
      subject.parent?.node &&
      NodeUtils.isTextContainer(subject.parent.node) &&
      NodeUtils.isGrapheme(subject.tip.node)
    ) {
      const provider = this.getProvider(subject);
      const ta = provider && provider.node && this.getNodeTextAnalyzer(provider.node, provider);
      // Fast mode?
      if (ta) {
        const startIndex = subject.tip.pathPart.index;
        const findGraphemeResult = ta.findGraphemeIndexOnSameLineButAt(target, startIndex);
        if (findGraphemeResult !== undefined) {
          const { index, side } = findGraphemeResult;
          estimatedSubjectSiblingsToTarget = index - startIndex;
          estimatedSubjectSiblingSideClosestToTarget = side;
        }
      }
    }

    const left = this.getLayout(subject, true);

    if (!left) {
      return undefined;
    }

    const leftSide = subjectSide === Side.Left ? left.left : left.right;

    const distance = target - leftSide;

    return { distance, estimatedSubjectSiblingsToTarget, estimatedSubjectSiblingSideClosestToTarget };
  }

  public detectLineWrapOrBreakBetweenNodes(
    preceeding: NodeNavigator | Chain,
    subsequent: NodeNavigator | Chain
  ): boolean | undefined {
    if (
      preceeding.parent?.node === subsequent.parent?.node &&
      NodeUtils.isGrapheme(preceeding.tip.node) &&
      NodeUtils.isGrapheme(subsequent.tip.node)
    ) {
      const provider = this.getProvider(preceeding);
      const ta = provider && provider.node && this.getNodeTextAnalyzer(provider.node, provider);
      // Fast mode?
      if (ta) {
        const leftIndex = preceeding.tip.pathPart.index;
        const rightIndex = subsequent.tip.pathPart.index;
        const lineWraps = ta.getAllGraphemeLineWraps();
        if (lineWraps) {
          if (lineWraps.size > 0) {
            // Note the line wraps indecies FOLLOW a line wrap (i.e.  start a
            // new line)
            for (const index of lineWraps) {
              if (index > leftIndex && index <= rightIndex) {
                return true;
              }
            }
          }
          return false;
        }
      }
    }

    const left = this.getLayout(preceeding, true);
    const right = this.getLayout(subsequent, true);
    if (left && right) {
      return !areRectsOnSameLine(left, right);
    }
    return undefined;
  }

  public dispose(): void {
    this.events.updateDone.removeListener(this.clearPerUpdateCachedInfo);
  }

  /**
   * This is not exposed in the NodeLayoutReporter interface from doctarion-document.
   */
  public getLayout(at: NodeNavigator | Chain, useCachedTextAnalyzer?: boolean): ClientRect | undefined {
    const provider = this.getProvider(at);
    if (!provider || !provider.node) {
      return undefined;
    }

    const tip = at.tip;
    if (NodeUtils.isGrapheme(tip.node)) {
      if (!tip.pathPart) {
        return undefined;
      }
      const gIndex = tip.pathPart.index;
      const ta = useCachedTextAnalyzer
        ? this.getNodeTextAnalyzer(provider.node, provider)
        : provider.getTextLayoutAnalyzer();
      return ta?.getGraphemeRect(gIndex) || undefined;
    } else {
      return provider.getLayout();
    }
  }

  public getTargetHorizontalAnchor(target: NodeNavigator | Chain, side: Side): HorizontalAnchor | undefined {
    const rect = this.getLayout(target, true);
    if (!rect) {
      return undefined;
    }
    return side === Side.Left ? rect.left : rect.right;
  }

  private clearPerUpdateCachedInfo = () => {
    this.temporaryNodeTextLayoutAnalyzers.clear();
  };

  private getNodeTextAnalyzer(node: Node, provider: NodeLayoutProvider): NodeTextLayoutAnalyzer | null {
    let analyzer = this.temporaryNodeTextLayoutAnalyzers.get(node);
    if (!analyzer) {
      const info = this.getNodeGraphemeInfo(node);
      if (!info) {
        return null;
      }
      analyzer = provider.getTextLayoutAnalyzer(info);
      if (!analyzer) {
        return null;
      }
      this.temporaryNodeTextLayoutAnalyzers.set(node, analyzer);
    }
    return analyzer;
  }

  private getProvider(at: NodeNavigator | Chain): NodeLayoutProvider | undefined {
    const chain: Chain = at instanceof NodeNavigator ? at.chain : at;
    const tip = chain.tip;
    let nodeWithProvider = tip.node;
    const isGrapheme = NodeUtils.isGrapheme(nodeWithProvider);

    if (isGrapheme) {
      const parent = chain.parent;
      if (!parent) {
        return undefined;
      }
      nodeWithProvider = parent.node;
    }

    return this.registry.getProviderForNode(nodeWithProvider);
  }
}
