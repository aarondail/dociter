import { Document } from "../document-model-rd4";

import { Chain } from "./chain";
import { ChainLink } from "./chainLink";
import { Path, PathString } from "./path";
import { PathPart } from "./pathPart";
import { PseudoNode } from "./pseudoNode";
import { PseudoNodeUtils } from "./pseudoNodeUtils";

export interface ReadonlyNodeNavigator {
  readonly chain: Chain;
  readonly grandParent: ChainLink | undefined;
  readonly parent: ChainLink | undefined;
  readonly tip: ChainLink;
  readonly path: Path;

  clone(): NodeNavigator;
}

/**
 * This class helps with navigating between nodes of a document. It does not
 * understand cursor navigation which is more complicated than just moving
 * between (fancy) graphemes. For that see the CursorNavigator class.
 *
 * The NodeNavigator maintains its own state, and methods on the class mutate
 * that state. That said, any data returned from the class won't be mutated by
 * future method calls (as the typescript type definitions say).
 *
 * For the DFS related navigation methods in this class, see the image on this
 * page to get a clear idea of the order in which the DFS visits nodes:
 * https://en.wikipedia.org/wiki/Depth-first_search
 */
export class NodeNavigator implements ReadonlyNodeNavigator {
  // Note this is a mutable property (can be changed) but the chain itself is
  // immutable
  private currentChain: Chain;

  /**
   * Construct a new NodeNavigator. The navigator's initial location will be
   * the document itself.
   */
  public constructor(document: Document);
  constructor(private readonly document: Document, initialChainUnchecked?: Chain) {
    if (initialChainUnchecked) {
      this.currentChain = initialChainUnchecked;
    } else {
      this.currentChain = new Chain(new ChainLink<Document>(document));
    }
  }

  public get chain(): Chain {
    return this.currentChain;
  }

  public get grandParent(): ChainLink | undefined {
    return this.currentChain.grandParent;
  }

  public get parent(): ChainLink | undefined {
    return this.currentChain.parent;
  }

  public get tip(): ChainLink {
    return this.currentChain.tip;
  }

  public get path(): Path {
    return this.currentChain.path;
  }

  public get nextSiblingNode(): PseudoNode | undefined {
    const result = this.currentChain.getParentAndTipIfPossible();
    if (!result) {
      return undefined;
    }
    const [parent, tip] = result;

    return navigateToSiblingHelpers.next(parent, tip.pathPart);
  }

  public get precedingSiblingNode(): PseudoNode | undefined {
    const result = this.currentChain.getParentAndTipIfPossible();
    if (!result) {
      return undefined;
    }
    const [parent, tip] = result;

    return navigateToSiblingHelpers.preceding(parent, tip.pathPart);
  }

  public get nextParentSiblingNode(): PseudoNode | undefined {
    const result = this.currentChain.getGrandParentToTipIfPossible();
    if (!result) {
      return undefined;
    }
    const [grandParent, parent] = result;

    return navigateToSiblingHelpers.next(grandParent, parent.pathPart);
  }

  public get precedingParentSiblingNode(): PseudoNode | undefined {
    const result = this.currentChain.getGrandParentToTipIfPossible();
    if (!result) {
      return undefined;
    }
    const [grandParent, parent] = result;

    return navigateToSiblingHelpers.preceding(grandParent, parent.pathPart);
  }

  public clone(): NodeNavigator {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
    return new (NodeNavigator as any)(this.document, this.currentChain);
  }

  public cloneWithoutTip(): NodeNavigator {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
    return new (NodeNavigator as any)(this.document, this.currentChain.dropTipIfPossible() || this.currentChain);
  }

  public hasNextSibling(): boolean {
    return this.nextSiblingNode !== undefined;
  }

  public hasPrecedingSibling(): boolean {
    return this.precedingSiblingNode !== undefined;
  }

  public isAtSamePositionAs(other: NodeNavigator): boolean {
    return this.path.equalTo(other.path);
  }

  /**
   * This will do a DFS backwards from the end of the document.  It is
   * different than just doing forwards DFS because it will visit parents
   * before children during its traversal, just like the forwards DFS.
   *
   * The navigateReverseForwardsInDfs method can be used to exactly iterate the
   * forwards DFS in reverse.
   *
   * The reason we have this (and use it in cursor navigation) is because when
   * navigating backwards there are cases where we want to visit parent nodes,
   * but just going backwards in the DFS would take us to the children first. A
   * case where this is important is w/ after insertion points on elements that
   * contain text (like InlineUrlLinks).
   */
  public navigateBackwardsByDfs(options?: { readonly skipDescendants?: boolean }): boolean {
    // In some cases you want to skip navigating through any descendants of the
    // current node. E.g. in the cursor navigator when it is 'before' an
    // InlineUrlLink that has contents... navigating backwards in this case should move off
    // the InlineUrlLink, not into its children.
    if (!options?.skipDescendants) {
      const children = PseudoNodeUtils.getChildren(this.tip.node);
      if (children?.length || 0 > 0) {
        return this.navigateToLastChild();
      }
    }

    const backup = this.currentChain;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.navigateToPrecedingSibling()) {
        return true;
      }

      if (!this.navigateToParent()) {
        this.currentChain = backup;
        return false;
      }
    }
  }

  /**
   * This navigates to the next node in a forward DFS. This will visit children
   * before siblings.
   */
  public navigateForwardsByDfs(options?: { readonly skipDescendants?: boolean }): boolean {
    // In some cases you want to skip navigating through any descendants of the
    // current node. E.g. in the cursor navigator when it is 'after' an
    // InlineUrlLink that has contents... navigating forwards in this case should move off
    // the InlineUrlLink, not into its children.
    if (!options?.skipDescendants) {
      const children = PseudoNodeUtils.getChildren(this.tip.node);
      if (children?.length || 0 > 0) {
        return this.navigateToFirstChild();
      }
    }

    const backup = this.currentChain;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.navigateToNextSibling()) {
        return true;
      }

      if (!this.navigateToParent()) {
        this.currentChain = backup;
        return false;
      }
    }
  }

  /**
   * This is slightly different than backwards as in backwards DFS will visit
   * parents before children just like the forwards DFS.  Reverse forwards will
   * visit children before parents, making it an exact reverse of the iteration
   * of the forwards DFS navigation.
   */
  public navigateReverseOfForwardsByDfs(): boolean {
    const backup = this.currentChain;
    if (this.navigateToPrecedingSibling()) {
      while (this.navigateToLastChild()) {
        // no-op?
      }
      return true;
    }

    if (this.navigateToParent()) {
      return true;
    }
    this.currentChain = backup;
    return false;
  }

  public navigateTo(path: PathString | Path): boolean {
    if (typeof path === "string") {
      const newPath = Path.parse(path);
      return this.navigateTo(newPath);
    }

    const newChain = Chain.from(this.document, path);
    if (newChain) {
      this.currentChain = newChain;
      return true;
    }
    return false;
  }

  public navigateToChild(index: number): boolean {
    return this.navigateToChildPrime(PseudoNodeUtils.getChildren(this.tip.node), index);
  }

  public navigateToDocumentNode(): boolean {
    return this.navigateToStartOfDfs();
  }

  public navigateToEndOfDfs(): boolean {
    // Jump to the document at the root
    this.navigateToStartOfDfs();

    while (this.navigateToLastChild()) {
      // Just keep going to the last child
    }
    return true;
  }

  public navigateToFirstChild(): boolean {
    return this.navigateToChildPrime(PseudoNodeUtils.getChildren(this.tip.node), 0);
  }

  public navigateToLastChild(): boolean {
    const children = PseudoNodeUtils.getChildren(this.tip.node);
    return this.navigateToChildPrime(children, (children?.length || 0) - 1);
  }

  /**
   * This navigates to a sibling after the current node, if there is one.
   * This will not jump to a different parent node.
   */
  public navigateToNextSibling(): boolean {
    const result = this.currentChain.getParentAndTipIfPossible();
    if (!result) {
      return false;
    }
    const [parent, tip] = result;

    const sibling = navigateToSiblingHelpers.nextLink(parent, tip.pathPart);
    if (sibling) {
      const newChain = this.currentChain.replaceTipIfPossible(sibling);
      if (newChain) {
        this.currentChain = newChain;
        return true;
      }
    }
    return false;
  }

  public navigateToParent(): boolean {
    // This won't ever drop the document link at the start of the chain
    const newChain = this.currentChain.dropTipIfPossible();
    if (newChain) {
      this.currentChain = newChain;
      return true;
    }
    return false;
  }

  /**
   * This navigates to a sibling before the current node, if there is one.
   * This will not jump to a different parent node.
   */
  public navigateToPrecedingSibling(): boolean {
    const result = this.currentChain.getParentAndTipIfPossible();
    if (!result) {
      return false;
    }
    const [parent, tip] = result;

    const sibling = navigateToSiblingHelpers.precedingLink(parent, tip.pathPart);
    if (sibling) {
      const newChain = this.currentChain.replaceTipIfPossible(sibling);
      if (newChain) {
        this.currentChain = newChain;
        return true;
      }
    }
    return false;
  }

  public navigateToRelativeSibling(offset: number): boolean {
    const result = this.currentChain.getParentAndTipIfPossible();
    if (!result) {
      return false;
    }
    const [parent, tip] = result;

    const sibling = navigateToSiblingHelpers.relativeLink(parent, tip.pathPart, offset);
    if (sibling) {
      const newChain = this.currentChain.replaceTipIfPossible(sibling);
      if (newChain) {
        this.currentChain = newChain;
        return true;
      }
    }
    return false;
  }

  /**
   * This ALWAYS means navigating to the document at the root of the node
   * hierarchy.
   */
  public navigateToStartOfDfs(): boolean {
    while (this.navigateToParent()) {
      // Keep going up
    }
    return true;
  }

  private navigateToChildPrime(children: readonly PseudoNode[] | undefined, index: number): boolean {
    const child = children?.[index];
    if (child) {
      const link = new ChainLink(child, new PathPart(index));
      // Link would only be undefined if someone the child was the document
      // which should obviously never happen
      if (!link) {
        return false;
      }
      this.currentChain = this.currentChain.append(link);
      return true;
    }
    return false;
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
const navigateToSiblingHelpers = (() => {
  const nodeOrLinkToNode = (a: PseudoNode | ChainLink): PseudoNode => {
    if ((a as any).node !== undefined) {
      return (a as any).node;
    }
    return a as PseudoNode;
  };

  const preceding = (parent: PseudoNode | ChainLink, childPath: PathPart): PseudoNode | undefined => {
    const parentNode = nodeOrLinkToNode(parent);
    const newPathPart = childPath.adjustIndex(-1);
    const childNode = newPathPart.resolve(parentNode);
    return childNode;
  };

  const next = (parent: PseudoNode | ChainLink, childPath: PathPart): PseudoNode | undefined => {
    const parentNode = nodeOrLinkToNode(parent);
    const newPathPart = childPath.adjustIndex(1);
    const childNode = newPathPart.resolve(parentNode);
    return childNode;
  };

  const relativeLink = (parent: PseudoNode | ChainLink, childPath: PathPart, offset: number): ChainLink | undefined => {
    const parentNode = nodeOrLinkToNode(parent);
    const newPathPart = childPath.adjustIndex(offset);
    const childNode = newPathPart.resolve(parentNode);
    if (childNode) {
      return new ChainLink(childNode, newPathPart);
    }
    return undefined;
  };

  const precedingLink = (parent: PseudoNode | ChainLink, childPath: PathPart): ChainLink | undefined =>
    relativeLink(parent, childPath, -1);

  const nextLink = (parent: PseudoNode | ChainLink, childPath: PathPart): ChainLink | undefined =>
    relativeLink(parent, childPath, 1);

  return { preceding, next, precedingLink, nextLink, relativeLink };
})();
