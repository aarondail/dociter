import { Document } from "../document-model-rd4";

import { Path } from "./path";
import { PathPart } from "./pathPart";
import { PseudoNode } from "./pseudoNode";

// -----------------------------------------------------------------------------
// This file defines Chain types and functions which are like Paths but with the
// corresponding Nodes (technically PseudoNodes) from the Document for each
// PathPart resolved.
//
// The first link in a Chain is always the Document.
// -----------------------------------------------------------------------------

export class ChainLink<T extends PseudoNode = PseudoNode> {
  public readonly node: T;
  public readonly pathPart: T extends Document ? undefined : PathPart;

  public constructor(node: T extends Document ? Document : never);
  public constructor(node: T, pathPart: PathPart);
  constructor(node: T, pathPart?: PathPart) {
    this.node = node;
    this.pathPart = pathPart as any;
  }
}

export class Chain {
  public readonly links: readonly ChainLink[];
  public constructor(...links: readonly ChainLink[]) {
    this.links = links;
  }

  public get grandParent(): ChainLink | undefined {
    const len = this.links.length;
    if (len < 3) {
      return undefined;
    }
    return this.links[len - 3];
  }

  public get length(): number {
    return this.links.length;
  }

  public get parent(): ChainLink | undefined {
    const len = this.links.length;
    if (len < 2) {
      return undefined;
    }
    return this.links[len - 2];
  }

  public get path(): Path {
    return new Path(
      ...this.links
        // Skip the document
        .slice(1)
        .map((x) => x.pathPart)
    );
  }

  public get tip(): ChainLink {
    return this.links[this.links.length - 1];
  }

  public get tipNode(): PseudoNode {
    return this.tip.node;
  }

  public append(newLink: ChainLink): Chain {
    return new Chain(...this.links, newLink);
  }

  public contains(node: PseudoNode): boolean {
    return this.links.find((link) => link.node === node) !== undefined;
  }

  /**
   * This drops the last link in the chain, unless there is only one node,
   * the document.  Aka the ChainLinkFirst.  This can't be
   * dropped safely because it would not adhere to the type definition for
   * Chain.
   */
  public dropTipIfPossible(): Chain | undefined {
    if (this.links.length > 1) {
      return new Chain(...this.links.slice(0, this.links.length - 1));
    }
    return undefined;
  }

  public getGrandParentToTipIfPossible(): [ChainLink, ChainLink, ChainLink] | undefined {
    const len = this.links.length;
    if (len < 3) {
      return undefined;
    }
    return [this.links[len - 3]!, this.links[len - 2]!, this.links[len - 1]!];
  }

  public getParentAndTipIfPossible(): [ChainLink, ChainLink] | undefined {
    const len = this.links.length;
    if (len < 2) {
      return undefined;
    }
    return [this.links[len - 2]!, this.links[len - 1]!];
  }

  /**
   * This replaces the last link in the chain, unless there is only one node,
   * the document. Aka the ChainLinkFirst. This can't be replaced safely (at
   * least not with a non first link) because it would not adhere to the type
   * definition for Chain.
   */
  public replaceTipIfPossible(newLink: ChainLink): Chain | undefined {
    if (this.links.length < 2) {
      return undefined;
    }
    const result = this.links.slice(0, this.links.length - 1);
    result.push(newLink);
    return new Chain(...result);
  }

  public searchBackwards(predicate: (node: PseudoNode) => boolean): ChainLink | undefined {
    for (let i = this.links.length - 1; i >= 0; i--) {
      const link = this.links[i]!;
      if (predicate(link.node)) {
        return link;
      }
    }
    return undefined;
  }

  public searchBackwardsAndSplit(
    nodePredicate: (node: PseudoNode) => boolean
  ): readonly [readonly ChainLink[], readonly ChainLink[]] | undefined {
    for (let i = this.links.length - 1; i >= 0; i--) {
      const link = this.links[i]!;
      if (nodePredicate(link.node)) {
        return [this.links.slice(0, i + 1), this.links.slice(i + 1)];
      }
    }
    return undefined;
  }

  public searchForwards(predicate: (node: PseudoNode) => boolean): ChainLink | undefined {
    for (let i = 0; i < this.links.length; i++) {
      const link = this.links[i]!;
      if (predicate(link.node)) {
        return link;
      }
    }
    return undefined;
  }

  public static from(document: Document, path: Path): Chain | undefined {
    const results: ChainLink[] = [new ChainLink<Document>(document)];
    let currentNode: PseudoNode = document;
    const pathParts = [...path.parts];
    while (pathParts.length > 0) {
      const pathPart = pathParts.shift();
      if (!pathPart) {
        return undefined;
      }
      const childNode = pathPart.resolve(currentNode);

      if (childNode === undefined) {
        return undefined;
      }
      results.push(new ChainLink(childNode, pathPart));
      currentNode = childNode;
    }
    // This is ok since we know the first node is a first link and the
    // others are non first links
    return new Chain(...results);
  }
}
