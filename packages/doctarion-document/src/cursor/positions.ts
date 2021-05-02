import { NodeNavigator } from "../basic-traversal";
import { enumWithMethods } from "../enumUtils";
import { NodeLayoutReporter } from "../layout-reporting";
import { InlineText, Node, NodeLayoutType, NodeUtils } from "../models";

// -----------------------------------------------------------------------------
// There are three or so places where a cursor may be placed GENERALLY:
// 1. Between, before, and after graphemes.
// 3. On an node that can contain children but does not currently have any
//    children.  This could be an empty InlineText or InlineUrlLink but could
//    be a ParagraphBlock or HeaderBlock or even the Document itself.
// 4. Between, before, or after any Inline node that is not an InlineText
//    node (e.g. InlineUrlLink) when the sibling is also not an InlineText
//    node (or there is no sibling).
//
// We refer to 1 as "graphemes", 2 as "empty insertion points", and 3 as
// "in-between insertion points".
//
// Also one thing to note is that some cursor positions are different but
// equivalent.  E.g. if two nodes are siblings, a position on the first
// node w/ after affinity is the same as a position on the second node
// with before affinity.
//
// Because of that, to make the behavior of things like navigation more
// deterministic we prefer some cursor positions to others even when they are
// equivalent. Specifically we bias towards positions after nodes and we prefer
// to those that relate to a grapheme vs not realted to one.
// -----------------------------------------------------------------------------

enum PositionClassificationBase {
  Grapheme = "GRAPHEME",
  EmptyInsertionPoint = "EMPTY_INSERTION_POINT",
  BeforeInBetweenInsertionPoint = "BEFORE_IN_BETWEEN_INSERTION_POINT",
  AfterInBetweenInsertionPoint = "AFTER_IN_BETWEEN_INSERTION_POINT",
}

export type PositionClassification = PositionClassificationBase;
export const PositionClassification = enumWithMethods(PositionClassificationBase, {
  isEmptyInsertionPoint(node: Node): boolean {
    return NodeUtils.getChildren(node)?.length === 0;
  },

  isInBetweenInsertionPoint(node: Node, adjacentSiblingNode?: Node): boolean {
    return (
      NodeUtils.isObject(node) &&
      node.layoutType === NodeLayoutType.Inline &&
      !(node instanceof InlineText) &&
      (!adjacentSiblingNode ||
        (NodeUtils.isObject(adjacentSiblingNode) &&
          adjacentSiblingNode.layoutType === NodeLayoutType.Inline &&
          !(adjacentSiblingNode instanceof InlineText)))
    );
  },

  getValidCursorAffinitiesAt(
    navigator: NodeNavigator,
    layoutReporter?: NodeLayoutReporter
  ): GetValidCursorAffinitiesAtResult {
    const el = navigator.tip.node;
    const precedingSibling = navigator.precedingSiblingNode;
    const nextSibling = navigator.nextSiblingNode;
    const parent = navigator.chain.parent?.node;
    console.log("here 1");
    if (NodeUtils.isGrapheme(el)) {
      console.log("here 2");
      // For text, we generally prefer after affinity. One case where we don't
      // is when the character is at the end or start of a line that was
      // visually wrapped.
      //
      // There are some additional cases but they are more complicated and there
      // are different rules for text inside an InlineText and for text in other
      // inline nodes.
      //
      // For InlineText we only suggest before affinity if the grapheme is the
      // first in the InlineText node and the preceding parent node (e.g. some
      // other inline node) is NOT an InlineText OR is an InlineText that has no
      // children
      //
      // For text in other inline nodes, it is simpler and it only matters if it
      // is the first grapheme in that node.
      let beforeIsValid;
      if (parent && NodeUtils.isTextContainer(parent) && precedingSibling === undefined) {
        console.log("here 2.1");
        if (parent instanceof InlineText) {
          const parentPrecedingSibling = navigator.precedingParentSiblingNode;
          if (
            !parentPrecedingSibling ||
            !(parentPrecedingSibling instanceof InlineText) ||
            parentPrecedingSibling.text.length === 0
          ) {
            beforeIsValid = true;
            // return CannedGetValidCursorAffinitiesAtResult.beforeAfter;
          }
        } else {
          beforeIsValid = true;
          // return CannedGetValidCursorAffinitiesAtResult.beforeAfter;
        }
      }
      // This handles the visual line wrapping rule
      if (layoutReporter) {
        {
          console.log("here 3");
          let hasNextLineWrap;
          console.log(navigator.tip.node);
          const nextNavigator = navigator.clone();
          if (nextNavigator.hasNextSibling()) {
            hasNextLineWrap =
              nextNavigator.navigateToNextSibling() &&
              layoutReporter.detectLineWrapOrBreakBetweenNodes(navigator, nextNavigator);
          } else {
            console.log("here 4");
            if (
              nextNavigator.navigateToParent() &&
              nextNavigator.navigateToNextSibling() &&
              parent instanceof InlineText &&
              nextNavigator.tip.node instanceof InlineText &&
              nextNavigator.navigateToFirstChild()
            ) {
              console.log("here 5");
              hasNextLineWrap = layoutReporter.detectLineWrapOrBreakBetweenNodes(navigator, nextNavigator);
            }
          }
          if (hasNextLineWrap) {
            console.log("here 6");
            return beforeIsValid
              ? CannedGetValidCursorAffinitiesAtResult.justBefore
              : CannedGetValidCursorAffinitiesAtResult.none;
          }
        }

        {
          let hasPrecedingLineWrap;
          const precedingNavigator = navigator.clone();
          if (precedingNavigator.hasPrecedingSibling()) {
            hasPrecedingLineWrap =
              precedingNavigator.navigateToPrecedingSibling() &&
              layoutReporter.detectLineWrapOrBreakBetweenNodes(precedingNavigator, navigator);
          } else {
            if (
              precedingNavigator.navigateToParent() &&
              precedingNavigator.navigateToPrecedingSibling() &&
              precedingNavigator.tip.node instanceof InlineText &&
              precedingNavigator.navigateToLastChild()
            ) {
              hasPrecedingLineWrap = layoutReporter.detectLineWrapOrBreakBetweenNodes(precedingNavigator, navigator);
            }
          }
          if (hasPrecedingLineWrap) {
            return CannedGetValidCursorAffinitiesAtResult.beforeAfter;
          }
        }
      }
      console.log("here 16");
      return beforeIsValid
        ? CannedGetValidCursorAffinitiesAtResult.beforeAfter
        : CannedGetValidCursorAffinitiesAtResult.justAfter;
    } else {
      const hasNeutral = this.isEmptyInsertionPoint(el);
      const hasBeforeBetweenInsertionPoint = PositionClassification.isInBetweenInsertionPoint(el, precedingSibling);
      const hasAfterBetweenInsertionPoint = PositionClassification.isInBetweenInsertionPoint(el, nextSibling);

      if (!hasNeutral && !hasBeforeBetweenInsertionPoint && !hasAfterBetweenInsertionPoint) {
        return CannedGetValidCursorAffinitiesAtResult.none;
      }

      console.log("XXXX", hasNeutral, hasBeforeBetweenInsertionPoint, hasAfterBetweenInsertionPoint);
      const result: GetValidCursorAffinitiesAtResult = {};
      // For in between insertion points, we ignore those in case there the
      // preceding or next sibiling element is an InlineText. Because in this
      // case we prefer to have the cursor on the existing InlineText (even if
      // it has no graphemes).
      if (hasBeforeBetweenInsertionPoint) {
        if (precedingSibling) {
          // Generally we don't allow before (since we prefer after) to true
          // here UNLESS the preceding object was on a new line
          const preceedingSiblingNavigator = navigator.clone();
          if (
            preceedingSiblingNavigator.navigateToPrecedingSibling() &&
            layoutReporter?.detectLineWrapOrBreakBetweenNodes(preceedingSiblingNavigator, navigator)
          ) {
            result.before = true;
          }
        } else {
          result.before = true;
        }
      }
      if (hasNeutral) {
        result.neutral = true;
      }
      if (hasAfterBetweenInsertionPoint && (!nextSibling || !(nextSibling instanceof InlineText))) {
        // Also make sure next inline is on the same line before saying we have after
        const nextSiblingNavigator = navigator.clone();
        if (
          nextSiblingNavigator.navigateToNextSibling() &&
          layoutReporter?.detectLineWrapOrBreakBetweenNodes(navigator, nextSiblingNavigator)
        ) {
          // Do nothing, we want the next sibling node to have a before cursor
          // position
        } else {
          result.after = true;
        }
      }
      return result;
    }
  },
});

export type GetValidCursorAffinitiesAtResult = {
  before?: boolean;
  after?: boolean;
  neutral?: boolean;
};

const CannedGetValidCursorAffinitiesAtResult = {
  beforeAfter: { before: true, after: true } as GetValidCursorAffinitiesAtResult,
  justAfter: { after: true } as GetValidCursorAffinitiesAtResult,
  justBefore: { before: true } as GetValidCursorAffinitiesAtResult,
  none: {},
};
