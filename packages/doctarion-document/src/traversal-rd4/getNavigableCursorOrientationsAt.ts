import { Node, NodeCategory, NodeChildrenType, Span } from "../document-model-rd5";

import { NodeNavigator } from "./nodeNavigator";
import { PseudoNode } from "./pseudoNode";

function isEmptyInsertionPoint(node: PseudoNode): boolean {
  if (node instanceof Node) {
    if (node.nodeType.childrenType === NodeChildrenType.None) {
      return false;
    }
    return node.children.length === 0;
  }
  return false;
}

/**
 * For in between insertion points, we ignore those in case there the preceding
 * or next sibling element is a Span. Because in this case we prefer to have the
 * cursor on the Span or its graphemes.
 */
function isInBetweenInsertionPoint(node: PseudoNode, adjacentSiblingNode?: PseudoNode): boolean {
  return (
    node instanceof Node &&
    node.nodeType.category === NodeCategory.Inline &&
    !(node.nodeType === Span) &&
    (!adjacentSiblingNode ||
      (adjacentSiblingNode instanceof Node &&
        adjacentSiblingNode.nodeType.category === NodeCategory.Inline &&
        adjacentSiblingNode.nodeType !== Span))
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

export function getNavigableCursorOrientationsAt(navigator: NodeNavigator): GetNavigableCursorOrientationsAtResult {
  const el = navigator.tip.node;
  const precedingSibling = navigator.precedingSiblingNode;
  const nextSibling = navigator.nextSiblingNode;

  if (PseudoNode.isGrapheme(el)) {
    // For text, we generally prefer after orientations. For Spans only suggest
    // before orientation if the grapheme is the first in the Span and the
    // preceding parent node (e.g. some other inline node) is NOT a Span OR
    // there is no preceding parent OR is a Span that has no children (even
    // though this case is something that shouldn't practically happen when
    // editing a document).
    //
    // For text in other inline nodes, it is simpler and it only matters if it
    // is the first grapheme in that node.

    const parent = navigator.chain.parent!.node as Node;

    let beforeIsValid;
    // If there is no preceding sibling to this grapheme, meaning this is the
    // first grapheme of the parent...
    if (precedingSibling === undefined) {
      if (parent.nodeType === Span) {
        const parentPrecedingSibling = navigator.precedingParentSiblingNode;
        if (
          !parentPrecedingSibling ||
          !((parentPrecedingSibling as Node).nodeType === Span) ||
          (parentPrecedingSibling as Node).children.length === 0
        ) {
          beforeIsValid = true;
        }
      } else {
        beforeIsValid = true;
      }
    }

    return beforeIsValid
      ? CannedGetNavigableCursorAffinitiesAtResult.beforeAfter
      : CannedGetNavigableCursorAffinitiesAtResult.justAfter;
  }

  // OK the Node is NOT a Grapheme...
  const hasOn = isEmptyInsertionPoint(el);
  const hasBeforeBetweenInsertionPoint = isInBetweenInsertionPoint(el, precedingSibling);
  const hasAfterBetweenInsertionPoint = isInBetweenInsertionPoint(el, nextSibling);

  if (!hasOn && !hasBeforeBetweenInsertionPoint && !hasAfterBetweenInsertionPoint) {
    return CannedGetNavigableCursorAffinitiesAtResult.none;
  }

  const result: GetNavigableCursorOrientationsAtResult = {};
  if (hasBeforeBetweenInsertionPoint) {
    if (precedingSibling) {
      // In this case we dont set before to true because we know after is true
      // and we want to prefer after orientations for these insertion
      // positions... I think?
    } else {
      result.before = true;
    }
  }
  if (hasOn) {
    result.on = true;
  }
  if (hasAfterBetweenInsertionPoint) {
    result.after = true;
  }
  return result;
}
