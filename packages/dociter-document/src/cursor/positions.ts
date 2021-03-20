import { Node, NodeNavigator } from "../basic-traversal";
import { enumWithMethods } from "../enumUtils";

import { CursorAffinity } from "./cursor";

// -----------------------------------------------------------------------------
// There are three or so places where a cursor may be placed GENERALLY:
// 1. Between, before, and after code points.
// 3. On an node that can contain children but does not currently have any
//    children.  This could be an empty InlineText or InlineUrlLink but could
//    be a ParagraphBlock or HeaderBlock or even the Document itself.
// 4. Between, before, or after any Inline node that is not an InlineText
//    node (e.g. InlineUrlLink) when the sibling is also not an InlineText
//    node (or there is no sibling).
//
// We refer to 1 as "code points", 2 as "empty insertion points", and 3 as
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
// to those that relate to a code point vs not realted to one.
// -----------------------------------------------------------------------------

enum PositionClassificationBase {
  CodePoint = "CODE_POINT",
  EmptyInsertionPoint = "EMPTY_INSERTION_POINT",
  BeforeInBetweenInsertionPoint = "BEFORE_IN_BETWEEN_INSERTION_POINT",
  AfterInBetweenInsertionPoint = "AFTER_IN_BETWEEN_INSERTION_POINT",
}

export type PositionClassification = PositionClassificationBase;
export const PositionClassification = enumWithMethods(PositionClassificationBase, {
  isEmptyInsertionPoint(node: Node): boolean {
    return Node.getChildren(node)?.length === 0;
  },

  isInBetweenInsertionPoint(node: Node, adjacentSiblingNode?: Node): boolean {
    return (
      Node.isInline(node) &&
      !Node.isInlineText(node) &&
      (!adjacentSiblingNode || (Node.isInline(adjacentSiblingNode) && !Node.isInlineText(adjacentSiblingNode)))
    );
  },

  getValidCursorAffinitiesAt(navigator: NodeNavigator): GetValidCursorAffinitiesAtResult {
    const el = navigator.tip.node;
    const precedingSibling = navigator.precedingSiblingNode;
    const nextSibling = navigator.nextSiblingNode;
    const parent = navigator.parent?.node;
    if (Node.isCodePoint(el)) {
      // There are different rules for text inside an InlineText and for text in
      // other inline nodes.
      //
      // For InlineText we only suggest before affinity if the code point is the
      // first in the InlineText node and the preceeding parent node (e.g. some
      // other inline node) is NOT an InlineText OR is an InlineText that has no
      // children.
      //
      // For text in other inline nodes, it is simpler and it only matters if it
      // is the first code point in that node.
      if (parent && Node.containsText(parent) && precedingSibling === undefined) {
        if (Node.isInlineText(parent)) {
          const parentPrecedingSibling = navigator.precedingParentSiblingNode;
          if (
            !parentPrecedingSibling ||
            !Node.isInlineText(parentPrecedingSibling) ||
            parentPrecedingSibling.text.length === 0
          ) {
            return CannedGetValidCursorAffinitiesAtResult.beforeAfter;
          }
        } else {
          return CannedGetValidCursorAffinitiesAtResult.beforeAfter;
        }
      }
      return CannedGetValidCursorAffinitiesAtResult.justAfter;
      // Only return before affinity is this is the first code point in the
      // inline text AND if the preceeding parent-level element is not an
      // inline text element.
    } else {
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
      // it has no code points).
      if (hasBeforeBetweenInsertionPoint && !precedingSibling) {
        result.before = true;
      }
      if (hasNeutral) {
        result.neutral = true;
      }
      if (hasAfterBetweenInsertionPoint && (!nextSibling || !Node.isInlineText(nextSibling))) {
        result.after = true;
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
  none: {},
};
