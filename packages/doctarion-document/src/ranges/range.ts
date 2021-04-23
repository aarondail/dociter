import { Chain, NodeNavigator, Path } from "../basic-traversal";
import * as Models from "../models";
import { Node } from "../nodes";

export interface Range {
  readonly from: Path;
  /**
   * This should always be after the from, in terms of the DFS the
   * NodeNavigator does.
   */
  readonly to: Path;
}

export const Range = {
  new: (from: Path, to: Path): Range => {
    return { from, to };
  },

  /**
   * This collects all chains in the range.
   */
  getChains(document: Models.Document, range: Range): readonly Chain[] {
    const results: Chain[] = [];
    Range.walk(document, range, (c) => results.push(c));
    return results;
  },

  /**
   * This gets chains in the range but tries to eliminate chains that are
   * redundant with other shorter chains in the range.
   *
   * E.g., if the range covers, say all graphemes in a InlineText, just the
   * chain for the InlineText would be returned, rather than for all the code
   * points (as well as for the InlineText).
   */
  getChainsCoveringRange(document: Models.Document, { from, to }: Range): Chain[] {
    // The implementation of this algorithm is pretty rough, I admit I didn't
    // fully reason this out but just plowed through by writing tests and
    // tweaking it until it worked.
    //
    // Probably it should be re-written.

    const nav = new NodeNavigator(document);
    if (!nav.navigateTo(from)) {
      return [];
    }
    if (Path.isEqual(from, to)) {
      return [nav.chain];
    }

    // Simple helper method
    const getKidCount = (node: Node) => Node.getChildren(node)?.length || 0;

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
      // to results or not (in conjunection with the found kid chains below).
      totalKidCount: number;
      // As we traverse the children of this element we store the chains we have
      // found for COMPLETELY contained elements here.  Partially contained
      // elements do not appear here... I think.
      foundKidChains: Chain[];
    }[] = [];

    // const debugAlg = (s?: string) => {
    //   console.log(
    //     `${s} - FOUND KID CHAINS in tracking`,
    //     trackingStack.map((l) =>
    //       l.foundKidChains
    //         .map(Chain.getPath)
    //         .map(Path.toString)
    //     ),
    //     " ... and results ... ",
    //     results.map(Chain.getPath).map(Path.toString)
    //   );
    // };

    const TrackingStack = {
      push(chain: Chain) {
        const link = Chain.getTip(chain);
        trackingStack.push({ chain, totalKidCount: getKidCount(link.node), foundKidChains: [] });
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
            n2.navigateToRoot();
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
        const l = trackingStack[trackingStack.length - 1];
        l.foundKidChains.push(chain);
      },
    };

    // -------------------
    // Setup TrackingStack
    // -------------------
    for (let i = 0; i < nav.chain.length - 1; i++) {
      const chain = (nav.chain.slice(0, i + 1) as unknown) as Chain;
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
      if (!nav.navigateForwardsInDfs()) {
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
        const p = Chain.getParentIfPossible(nav.chain)!.node;
        const totalKidCount = getKidCount(p);
        if (totalKidCount > 0) {
          TrackingStack.push(Chain.dropTipIfPossible(nav.chain) || nav.chain);
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
      if (Path.isEqual(nav.path, to)) {
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
  },

  /**
   * This walks through all nodes in the range.
   */
  walk(document: Models.Document, { from, to }: Range, callback: (chain: Chain) => void): void {
    const nav = new NodeNavigator(document);
    if (!nav.navigateTo(from)) {
      return;
    }

    callback(nav.chain);
    if (Path.isEqual(from, to)) {
      return;
    }
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!nav.navigateForwardsInDfs()) {
        return;
      }
      callback(nav.chain);
      if (Path.isEqual(nav.path, to)) {
        return;
      }
    }
  },
};
