import { NodeNavigator } from "../basic-traversal";
import { enumWithMethods } from "../enumUtils";
import { NodeLayoutReporter } from "../layout-reporting";
import { InlineText, Node, NodeLayoutType, NodeUtils } from "../models";

// -----------------------------------------------------------------------------
// There are five kinds of places where a cursor may be placed.
// 1. Around (but not on) graphemes in some text containing Inline element (e.g.
//    InlineText or InlineUrlLink).
// 2. On a text containing node, or an inline containing node, that can contain
//    children but does not currently have any children.  This could be an
//    empty InlineText or InlineUrlLink, or an empty ParagraphBlock or
//    HeaderBlock or even the Document itself.
// 3. Between, before, or after any Inline node that is not an InlineText
//    node (e.g. InlineUrlLink) when the sibling is also not an InlineText
//    node (or there is no sibling).
// 4. On a node that is not text containing and is not a grapheme. These are
//    nodes that can be navigated to with normal cursor movement but cannot
//    contain text, like a emoji or inline image.
// 5. On _any_ node (including graphemes and nodes like those described by 4).
//    This position can not be reached by normal navigation within the
//    document. Rather it is always the result of selections. E.g., selecting an
//    entire Paragraph node.
//
// For 1 and 3, the cursor can be before or after the node its on, meaning its
// between the node and its preceeding or following sibling, but not actually on
// the node. This is represented by the cursor having a Before or After
// CursorOrientation. For 2, 4, and 5 the cursor is always on the node. This is
// represented by the cursor having a On CursorOrientation
//
// Also 1,2,3 represent positions where text can be inserted, whereas 4 and 5
// don't. Text may (potentially) replace the node the cursor is on at 4 or 5,
// but it can't be inserted (generally) while preserving the node.
//
// Finally, as mentioned above, 1,2,3, and 4, are all normal positions in that
// they can be reached by simple navigation (moving back, forward, up, down,
// etc).  5 is not like that.
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

  getValidCursorOrientationsAt(
    navigator: NodeNavigator,
    layoutReporter?: NodeLayoutReporter
  ): GetValidCursorOrientationsAtResult {
    const el = navigator.tip.node;
    const precedingSibling = navigator.precedingSiblingNode;
    const nextSibling = navigator.nextSiblingNode;
    const parent = navigator.chain.parent?.node;

    if (NodeUtils.isGrapheme(el)) {
      // For text, we generally prefer after orientation.  One case where we don't
      // is when the character is at the end or start of a line that was
      // visually wrapped.  In that case the grapheme before the wrap generally
      // has no affinities and the one after has before.
      //
      // There are some additional cases but they are more complicated and there
      // are different rules for text inside an InlineText and for text in other
      // inline nodes.
      //
      // For InlineText we only suggest before orientation if the grapheme is the
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

      const result: GetValidCursorOrientationsAtResult = {};
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

export type GetValidCursorOrientationsAtResult = {
  before?: boolean;
  after?: boolean;
  neutral?: boolean;
};

const CannedGetValidCursorAffinitiesAtResult = {
  beforeAfter: { before: true, after: true } as GetValidCursorOrientationsAtResult,
  justAfter: { after: true } as GetValidCursorOrientationsAtResult,
  justBefore: { before: true } as GetValidCursorOrientationsAtResult,
  none: {},
};
