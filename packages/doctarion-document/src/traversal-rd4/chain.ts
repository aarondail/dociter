import { Document, Node } from "../document-model-rd4";

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

export class ChainLink<NodeType extends Node = Node> {
  public readonly node: PseudoNode<NodeType>;
  public readonly pathPart?: PathPart;

  public constructor(node: PseudoNode<NodeType>, pathPart?: PathPart) {
    this.node = node;
    this.pathPart = pathPart as any;
  }
}

export class Chain<NodeType extends Node = Node> {
  public readonly links: readonly ChainLink<NodeType>[];

  public constructor(...links: readonly ChainLink<NodeType>[]) {
    this.links = links;
  }

  public get grandParent(): ChainLink<NodeType> | undefined {
    const len = this.links.length;
    if (len < 3) {
      return undefined;
    }
    return this.links[len - 3];
  }

  public get length(): number {
    return this.links.length;
  }

  public get parent(): ChainLink<NodeType> | undefined {
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
        .map((x) => x.pathPart!)
    );
  }

  public get tip(): ChainLink<NodeType> {
    return this.links[this.links.length - 1];
  }

  public get tipNode(): PseudoNode<NodeType> {
    return this.tip.node;
  }

  public append(newLink: ChainLink<NodeType>): Chain<NodeType> {
    return new Chain<NodeType>(...this.links, newLink);
  }

  public contains(node: PseudoNode<NodeType>): boolean {
    return this.links.find((link) => link.node === node) !== undefined;
  }

  /**
   * This drops the last link in the chain, unless there is only one node, the
   * document. This can't be dropped safely because it would not adhere to the
   * type definition for Chain.
   */
  public dropTipIfPossible(): Chain<NodeType> | undefined {
    if (this.links.length > 1) {
      return new Chain<NodeType>(...this.links.slice(0, this.links.length - 1));
    }
    return undefined;
  }

  public getGrandParentToTipIfPossible(): [ChainLink<NodeType>, ChainLink<NodeType>, ChainLink<NodeType>] | undefined {
    const len = this.links.length;
    if (len < 3) {
      return undefined;
    }
    return [this.links[len - 3]!, this.links[len - 2]!, this.links[len - 1]!];
  }

  public getParentAndTipIfPossible(): [ChainLink<NodeType>, ChainLink<NodeType>] | undefined {
    const len = this.links.length;
    if (len < 2) {
      return undefined;
    }
    return [this.links[len - 2]!, this.links[len - 1]!];
  }

  /**
   * This replaces the last link in the chain, unless there is only one node,
   * the document. This can't be replaced safely (at least not with a non first
   * link) because it would not adhere to the type definition for Chain.
   */
  public replaceTipIfPossible(newLink: ChainLink<NodeType>): Chain<NodeType> | undefined {
    if (this.links.length < 2) {
      return undefined;
    }
    const result = this.links.slice(0, this.links.length - 1);
    result.push(newLink);
    return new Chain<NodeType>(...result);
  }

  public searchBackwards(
    predicateOrNode: PseudoNode | ((node: PseudoNode<NodeType>) => boolean)
  ): ChainLink<NodeType> | undefined {
    if (typeof predicateOrNode === "function") {
      for (let i = this.links.length - 1; i >= 0; i--) {
        const link = this.links[i]!;
        if (predicateOrNode(link.node)) {
          return link;
        }
      }
    } else {
      for (let i = this.links.length - 1; i >= 0; i--) {
        const link = this.links[i]!;
        if (link.node === predicateOrNode) {
          return link;
        }
      }
    }
    return undefined;
  }

  public searchBackwardsAndSplit(
    predicateOrNode: PseudoNode | ((node: PseudoNode<NodeType>) => boolean)
  ): readonly [readonly ChainLink<NodeType>[], readonly ChainLink<NodeType>[]] | undefined {
    if (typeof predicateOrNode === "function") {
      for (let i = this.links.length - 1; i >= 0; i--) {
        const link = this.links[i]!;
        if (predicateOrNode(link.node)) {
          return [this.links.slice(0, i + 1), this.links.slice(i + 1)];
        }
      }
    } else {
      for (let i = this.links.length - 1; i >= 0; i--) {
        const link = this.links[i]!;
        if (link.node === predicateOrNode) {
          return [this.links.slice(0, i + 1), this.links.slice(i + 1)];
        }
      }
    }
    return undefined;
  }

  // public searchForwards(predicate: (node: PseudoNode<NodeType>) => boolean): ChainLink<NodeType> | undefined {
  //   for (let i = 0; i < this.links.length; i++) {
  //     const link = this.links[i]!;
  //     if (predicate(link.node)) {
  //       return link;
  //     }
  //   }
  //   return undefined;
  // }

  public static from<NodeType extends Node>(document: Document & NodeType, path: Path): Chain<NodeType> | undefined {
    const results: ChainLink<NodeType>[] = [new ChainLink<NodeType>(document, undefined)];
    let currentNode: PseudoNode<NodeType> = document;
    const pathParts = [...path.parts];
    while (pathParts.length > 0) {
      const pathPart = pathParts.shift();
      if (!pathPart) {
        return undefined;
      }
      const childNode: PseudoNode<NodeType> | undefined = pathPart.resolve<NodeType>(currentNode);

      if (childNode === undefined) {
        return undefined;
      }
      results.push(new ChainLink<NodeType>(childNode, pathPart));
      currentNode = childNode;
    }
    // This is ok since we know the first node is a first link and the
    // others are non first links
    return new Chain(...results);
  }
}
