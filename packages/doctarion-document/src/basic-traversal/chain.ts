import * as IterTools from "iter-tools";

import { Block, Document, Grapheme, Inline, Node } from "../models";

import { Path, PathPart } from "./path";

// -----------------------------------------------------------------------------
// This file defines Chain types and functions which are like Paths but with the
// corresponding Nodes from the Document for each PathPart resolved.
//
// The first link (if you will) in a Chain is always the Document.
// -----------------------------------------------------------------------------

export type Chain = readonly [ChainLinkFirst, ...ChainLinkNotFirst[]];

/**
 * This type represents a Node that has been resolved for a PathPart.
 */
export type ChainLink = ChainLinkFirst | ChainLinkNotFirst;

/**
 * The first link in any change should be the document. In this case it does
 * not have a PathPart.
 */
export interface ChainLinkFirst {
  readonly pathPart: undefined;
  readonly node: Document;
}

export interface ChainLinkNotFirst<T extends Node = Node> {
  readonly pathPart: PathPart;
  readonly node: T;
}

export const ChainLink = (() => {
  const build = (pathPart: PathPart, node: Node): ChainLinkNotFirst => ({
    pathPart,
    node,
  });

  return {
    newNonFirstLink: build,
    document: (d: Document): ChainLinkFirst => ({
      pathPart: undefined,
      node: d,
    }),
    block: (b: Block, index: number) => build(PathPart.block(index), b),
    content: (i: Inline, index: number) => build(PathPart.content(index), i),
    grapheme: (g: Grapheme, index: number) => build(PathPart.grapheme(index), g),
  };
})();

export const Chain = {
  append(chain: Chain, newLink: ChainLinkNotFirst): Chain {
    // Assuming chain is ok, this is ok too
    return ([...chain, newLink] as unknown) as Chain;
  },

  contains(chain: Chain, node: Node): boolean {
    return chain.find((link) => link.node === node) !== undefined;
  },

  /**
   * This drops the last link in the chain, unless there is only one node,
   * the document.  Aka the ChainLinkFirst.  This can't be
   * dropped safely because it would not adhere to the type definition for
   * Chain.
   */
  dropTipIfPossible(chain: Chain): Chain | undefined {
    if (chain.length > 1) {
      return (chain.slice(0, chain.length - 1) as unknown) as Chain;
    }
    return undefined;
  },

  searchBackwards(chain: Chain, predicate: (node: Node) => boolean): Node | undefined {
    for (let i = chain.length - 1; i >= 0; i--) {
      if (predicate(chain[i].node)) {
        return chain[i].node;
      }
    }
    return undefined;
  },

  searchForwards(chain: Chain, predicate: (node: Node) => boolean): Node | undefined {
    for (let i = 0; i < chain.length; i++) {
      if (predicate(chain[i].node)) {
        return chain[i].node;
      }
    }
    return undefined;
  },

  getGrandParentToTipIfPossible(chain: Chain): [ChainLink, ChainLinkNotFirst, ChainLinkNotFirst] | undefined {
    const len = chain.length;
    if (len < 3) {
      return undefined;
    }
    return [chain[len - 3], chain[len - 2] as ChainLinkNotFirst, chain[len - 1] as ChainLinkNotFirst];
  },

  getPath(chain: Chain): Path {
    return (
      chain
        // Skip the document
        .slice(1)
        .map((x) => (x as ChainLinkNotFirst).pathPart)
    );
  },

  getParentIfPossible(chain: Chain): ChainLink | undefined {
    const len = chain.length;
    if (len < 2) {
      return undefined;
    }
    return chain[len - 2];
  },

  getParentAndTipIfPossible(chain: Chain): [ChainLink, ChainLinkNotFirst] | undefined {
    const len = chain.length;
    if (len < 2) {
      return undefined;
    }
    return [chain[len - 2], chain[len - 1] as ChainLinkNotFirst];
  },

  getTip(chain: Chain): ChainLink {
    return IterTools.arrayLast((chain as unknown) as unknown[]) as ChainLink;
  },

  getTipNode(chain: Chain): Node {
    return Chain.getTip(chain).node;
  },

  from(document: Document, path: Path): Chain | undefined {
    const results: ChainLink[] = [ChainLink.document(document)];
    let currentNode: Node = document;
    const pathParts = [...path];
    while (pathParts.length > 0) {
      const pathPart = pathParts.shift();
      if (!pathPart) {
        return undefined;
      }
      const childNode = PathPart.resolveToChild(currentNode, pathPart);

      if (childNode === undefined) {
        return undefined;
      }
      results.push(ChainLink.newNonFirstLink(pathPart, childNode));
      currentNode = childNode;
    }
    // This is ok since we know the first node is a first link and the
    // others are non first links
    return (results as unknown) as Chain;
  },

  /**
   * This replaces the last link in the chain, unless there is only one node,
   * the document. Aka the ChainLinkFirst. This can't be replaced safely (at
   * least not with a non first link) because it would not adhere to the type
   * definition for Chain.
   */
  replaceTipIfPossible(Chain: Chain, newLink: ChainLinkNotFirst): Chain | undefined {
    if (Chain.length < 2) {
      return undefined;
    }
    const result = Chain.slice(0, Chain.length - 1);
    result.push(newLink);
    return (result as unknown) as Chain;
  },
};
