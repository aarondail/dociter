import { NodeNavigator } from "../basic-traversal";
import { enumWithMethods } from "../enumUtils";
import { NodeLayoutReporter } from "../layout-reporting";
import { InlineText, Node, NodeLayoutType, NodeUtils } from "../models";

// -----------------------------------------------------------------------------
// There are three or so kinds of places where a cursor may be placed GENERALLY:
// 1. Between, before, and after graphemes.
// 2. On an node that can contain children but does not currently have any
//    children.  This could be an empty InlineText or InlineUrlLink but could
//    be a ParagraphBlock or HeaderBlock or even the Document itself.
// 3. Between, before, or after any Inline node that is not an InlineText
//    node (e.g. InlineUrlLink) when the sibling is also not an InlineText
//    node (or there is no sibling).
//
// We refer to 1 as "graphemes", 2 as "empty insertion points", and 3 as
// "in-between insertion points".
//
// See design/CURSOR.md for more info.
// -----------------------------------------------------------------------------

enum PositionClassificationBase {
  Grapheme = "GRAPHEME",
  EmptyInsertionPoint = "EMPTY_INSERTION_POINT",
  InBetweenInsertionPoint = "IN_BETWEEN_INSERTION_POINT",
  // ADD NavigableNonTextNode
  // ADD UnconstrainedAnyNode

  // MOVE classify into this file
  // UPDATE CUrsor.md and comments in this file
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

    if (NodeUtils.isGrapheme(el)) {
      // For text, we generally prefer after affinity.  One case where we don't
      // is when the character is at the end or start of a line that was
      // visually wrapped.  In that case the grapheme before the wrap generally
      // has no affinities and the one after has before.
      //
      // There are some additional cases but they are more complicated and there
      // are different rules for text inside an InlineText and for text in other
      // inline nodes.
      //
      // For InlineText we only suggest before affinity if the grapheme is the
      // first in the InlineText node and the preceding parent node (e.g. some
      // other inline node) is NOT an InlineText OR is an InlineText that has no
      // children OR is at the start of the line.
      //
      // For text in other inline nodes, it is simpler and it only matters if it
      // is the first grapheme in that node.
      let beforeIsValid;
      if (parent && NodeUtils.isTextContainer(parent) && precedingSibling === undefined) {
        if (parent instanceof InlineText) {
          const parentPrecedingSibling = navigator.precedingParentSiblingNode;
          if (
            !parentPrecedingSibling ||
            !(parentPrecedingSibling instanceof InlineText) ||
            parentPrecedingSibling.text.length === 0
          ) {
            beforeIsValid = true;
          }
        } else {
          beforeIsValid = true;
        }
      }
      // This handles the visual line wrapping rule
      if (layoutReporter) {
        {
          let hasNextLineWrap;
          const nextNavigator = navigator.clone();
          if (nextNavigator.hasNextSibling()) {
            hasNextLineWrap =
              nextNavigator.navigateToNextSibling() &&
              layoutReporter.detectLineWrapOrBreakBetweenNodes(navigator, nextNavigator);
          } else {
            if (
              nextNavigator.navigateToParent() &&
              nextNavigator.navigateToNextSibling() &&
              parent instanceof InlineText &&
              nextNavigator.tip.node instanceof InlineText &&
              nextNavigator.navigateToFirstChild()
            ) {
              hasNextLineWrap = layoutReporter.detectLineWrapOrBreakBetweenNodes(navigator, nextNavigator);
            }
          }
          if (hasNextLineWrap) {
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

      return beforeIsValid
        ? CannedGetValidCursorAffinitiesAtResult.beforeAfter
        : CannedGetValidCursorAffinitiesAtResult.justAfter;
    } else {
      // Node is not a grapheme
      const hasNeutral = this.isEmptyInsertionPoint(el);
      const hasBeforeBetweenInsertionPoint = PositionClassification.isInBetweenInsertionPoint(el, precedingSibling);
      const hasAfterBetweenInsertionPoint = PositionClassification.isInBetweenInsertionPoint(el, nextSibling);

      if (!hasNeutral && !hasBeforeBetweenInsertionPoint && !hasAfterBetweenInsertionPoint) {
        return CannedGetValidCursorAffinitiesAtResult.none;
      }

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
