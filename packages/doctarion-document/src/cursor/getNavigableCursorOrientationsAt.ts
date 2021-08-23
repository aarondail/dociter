import { NodeNavigator } from "../basic-traversal";
import { InlineText, Node, NodeLayoutType, NodeUtils } from "../models";

import { NodeLayoutReporter } from "./layoutReporter";

// -----------------------------------------------------------------------------
// This file is responsible for detecting which "navigable" cursor positions are
// available for a particular node.
//
// See design/CURSOR.md for more info.
// -----------------------------------------------------------------------------

function isEmptyInsertionPoint(node: Node): boolean {
  return NodeUtils.getChildren(node)?.length === 0;
}

function isInBetweenInsertionPoint(node: Node, adjacentSiblingNode?: Node): boolean {
  return (
    NodeUtils.isObject(node) &&
    node.layoutType === NodeLayoutType.Inline &&
    !(node instanceof InlineText) &&
    (!adjacentSiblingNode ||
      (NodeUtils.isObject(adjacentSiblingNode) &&
        adjacentSiblingNode.layoutType === NodeLayoutType.Inline &&
        !(adjacentSiblingNode instanceof InlineText)))
  );
}

export type GetNavigableCursorOrientationsAtResult = {
  before?: boolean;
  after?: boolean;
  on?: boolean;
};

const CannedGetNavigableCursorAffinitiesAtResult = {
  beforeAfter: { before: true, after: true } as GetNavigableCursorOrientationsAtResult,
  justAfter: { after: true } as GetNavigableCursorOrientationsAtResult,
  justBefore: { before: true } as GetNavigableCursorOrientationsAtResult,
  none: {},
};

export function getNavigableCursorOrientationsAt(
  navigator: NodeNavigator,
  layoutReporter?: NodeLayoutReporter
): GetNavigableCursorOrientationsAtResult {
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
            ? CannedGetNavigableCursorAffinitiesAtResult.justBefore
            : CannedGetNavigableCursorAffinitiesAtResult.none;
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
          return CannedGetNavigableCursorAffinitiesAtResult.beforeAfter;
        }
      }
    }

    return beforeIsValid
      ? CannedGetNavigableCursorAffinitiesAtResult.beforeAfter
      : CannedGetNavigableCursorAffinitiesAtResult.justAfter;
  } else {
    // Node is not a grapheme
    const hasOn = isEmptyInsertionPoint(el) || NodeUtils.isInlineNonTextContainer(el);
    const hasBeforeBetweenInsertionPoint = isInBetweenInsertionPoint(el, precedingSibling);
    const hasAfterBetweenInsertionPoint = isInBetweenInsertionPoint(el, nextSibling);

    if (!hasOn && !hasBeforeBetweenInsertionPoint && !hasAfterBetweenInsertionPoint) {
      return CannedGetNavigableCursorAffinitiesAtResult.none;
    }

    const result: GetNavigableCursorOrientationsAtResult = {};
    // For in between insertion points, we ignore those in case there the
    // preceding or next sibling element is an InlineText. Because in this
    // case we prefer to have the cursor on the existing InlineText (even if
    // it has no graphemes).
    if (hasBeforeBetweenInsertionPoint) {
      if (precedingSibling) {
        // Generally we don't allow before (since we prefer after) to true
        // here UNLESS the preceding object was on a new line
        const precedingSiblingNavigator = navigator.clone();
        if (
          precedingSiblingNavigator.navigateToPrecedingSibling() &&
          layoutReporter?.detectLineWrapOrBreakBetweenNodes(precedingSiblingNavigator, navigator)
        ) {
          result.before = true;
        }
      } else {
        result.before = true;
      }
    }
    if (hasOn) {
      result.on = true;
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
}
