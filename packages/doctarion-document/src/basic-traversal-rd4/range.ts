import { Document, Node } from "../document-model-rd4";

import { Chain } from "./chain";
import { NodeNavigator } from "./nodeNavigator";
import { Path, PathComparison } from "./path";
import { PseudoNode } from "./pseudoNode";

export class Range {
  public constructor(
    public readonly from: Path,
    /**
     * This should always be after the from.
     */
    public readonly to: Path
  ) {}

  /**
   * This collects all chains in the range.
   */
  public getChains(document: Document): readonly Chain[] {
    const results: Chain[] = [];
    this.walkChains(document, (c) => results.push(c));
    return results;
  }

  /**
   * This gets chains in the range but tries to eliminate chains that are
   * redundant with other shorter chains in the range.
   *
   * E.g., if the range covers, say all graphemes in a InlineText, just the
   * chain for the InlineText would be returned, rather than for all the code
   * points (as well as for the InlineText).
   */
  public getChainsCoveringRange(document: Document): Chain[] {
    const { from, to } = this;
    // The implementation of this algorithm is pretty rough, I admit I didn't
    // fully reason this out but just plowed through by writing tests and
    // tweaking it until it worked.
    //
    // Probably it should be re-written.

    const nav = new NodeNavigator(document);
    if (!nav.navigateTo(from)) {
      return [];
    }
    if (from.equalTo(to)) {
      return [nav.chain];
    }

    // Simple helper method
    const getKidCount = (node: PseudoNode) => (node instanceof Node ? node.children?.length || 0 : 0);

    //----------------------------------------------------------
    // Results and Tracking State definition, and helper methods
    //----------------------------------------------------------

    // Results is where we store chains we are done processing and are are going
    // to return (unless we hit a problem).
    const results: Chain[] = [];
    // The tracking stack stores state for every level of depth in the element
    // hierarchy we have gone through to reach the current element.  The current
    // element doesn't get its own entry.  The current element starts at the from
    // parameter and then goes from there (in the while loop below).
    const trackingStack: {
      // The chian for the element
      chain: Chain;
      // Total number of kids, used to decide if the entire element can be added
      // to results or not (in conjunction with the found kid chains below).
      totalKidCount: number;
      // As we traverse the children of this element we store the chains we have
      // found for COMPLETELY contained elements here.  Partially contained
      // elements do not appear here... I think.
      foundKidChains: Chain[];
    }[] = [];

    const TrackingStack = {
      push(chain: Chain) {
        const link = chain.tip;
        trackingStack.push({
          chain,
          totalKidCount: getKidCount(link.node),
          foundKidChains: [],
        });
      },
      /**
       * This is where things get moved from the tracking stack to results.
       *
       * Note this returns a boolean indicate whether the popped node in the stack
       * was added wholesale added to its parent in the tracking stack (true) or
       * not (false) and it was added to the results.
       */
      pop() {
        const info = trackingStack.pop();
        if (!info) {
          return false;
        }
        if (info.foundKidChains.length === info.totalKidCount) {
          // OK looks like we found all of these
          const l = trackingStack[trackingStack.length - 1];
          if (l) {
            l.foundKidChains.push(info.chain);
          } else {
            // This must be the document itself
            const n2 = nav.clone();
            n2.navigateToDocumentNode();
            results.push(n2.chain);
            return false;
          }
          return true;
        } else {
          for (const c of info.foundKidChains) {
            results.push(c);
          }
        }
        return false;
      },
      add(chain: Chain) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const l = trackingStack[trackingStack.length - 1]!;
        l.foundKidChains.push(chain);
      },
    };

    // -------------------
    // Setup TrackingStack
    // -------------------
    for (let i = 0; i < nav.chain.length - 1; i++) {
      const chain = new Chain(...nav.chain.links.slice(0, i + 1));
      TrackingStack.push(chain);
    }

    // Track the from element IF it doesn't have kids
    if (getKidCount(nav.tip.node) === 0) {
      TrackingStack.add(nav.chain);
    }

    // -----------------
    // Traverse Document
    // -----------------
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const chainLengthBefore = nav.chain.length;
      if (!nav.navigateForwardsByDfs()) {
        // If we can't navigate forward, then abort and return nothing
        return [];
      }
      const chainLengthAfter = nav.chain.length;

      // debugAlg("in while");

      // Based on the respective depth we are in the node tree, determine
      // whether we have moved down into a new depth, or up.
      if (chainLengthBefore + 1 === chainLengthAfter) {
        // Parent --> Child
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const p = nav.chain.parent!.node;
        const totalKidCount = getKidCount(p);
        if (totalKidCount > 0) {
          TrackingStack.push(nav.chain.dropTipIfPossible() || nav.chain);
        }
      } else if (chainLengthBefore > chainLengthAfter) {
        // Child --> A different parent
        let i = chainLengthBefore;
        while (i > chainLengthAfter) {
          i--;
          if (!TrackingStack.pop()) {
            break;
          }
        }
      } else if (chainLengthBefore !== chainLengthAfter) {
        throw new Error(
          `Unexpected difference between chainLengthBefore ${chainLengthBefore} and chainLengthAfter ${chainLengthAfter}`
        );
      }

      // Have we reached the end or not?
      if (nav.path.equalTo(to)) {
        // Yes we have reached the end.
        break;
      }

      // Track this element and continue traversing
      if (getKidCount(nav.tip.node) === 0) {
        TrackingStack.add(nav.chain);
      }
    }

    // -------
    // Wrap up
    // -------

    // Track the final element (even if it has kids in this case)
    TrackingStack.add(nav.chain);

    // Now pop all the tracking stack layers we can.  This will return false
    // and break from the loop once we have reached a node that (once popped)
    // did not get completely traversed, and thus got added directly to
    // results instead of the foundKidChains of its parent tracking stack
    // node.
    while (trackingStack.length > 0) {
      if (!TrackingStack.pop()) {
        break;
      }
    }

    // Now if there are any foundKidChains left in the remaining layers,
    // prepend those to the front of the results... in reverse order
    trackingStack.reverse().forEach((n) => n.foundKidChains.reverse().forEach((chain) => results.unshift(chain)));

    // And we are finally done
    return results;
  }

  /**
   * This walks through all nodes in the range. The callback is called with a
   * NodeNavigator, which (note!) is reused not cloned between calls.
   */
  public walk(
    document: Document,
    callback: (navigator: NodeNavigator) => void,
    filter?: (node: PseudoNode) => boolean,
    skipDescendants?: (node: PseudoNode) => boolean
  ): void {
    const nav = new NodeNavigator(document);
    if (!nav.navigateTo(this.from)) {
      return;
    }

    if (filter && filter(nav.tip.node)) {
      callback(nav);
    }
    if (this.from.equalTo(this.to)) {
      return;
    }
    let skipDescendantsPrime = false;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!nav.navigateForwardsByDfs(skipDescendantsPrime ? { skipDescendants: true } : undefined)) {
        return;
      }
      skipDescendantsPrime = false;
      if (skipDescendants && skipDescendants(nav.tip.node)) {
        skipDescendantsPrime = true;
      }
      if (filter && filter(nav.tip.node)) {
        callback(nav);
      }
      const cmp = nav.path.compareTo(this.to);
      if ((skipDescendants && cmp === PathComparison.Ancestor) || cmp === PathComparison.Equal) {
        return;
      }
    }
  }

  public walkChains(
    document: Document,
    callback: (chain: Chain) => void,
    filter?: (node: PseudoNode) => boolean,
    skipDescendants?: (node: PseudoNode) => boolean
  ): void {
    return this.walk(document, (n) => callback(n.chain), filter, skipDescendants);
  }
}
