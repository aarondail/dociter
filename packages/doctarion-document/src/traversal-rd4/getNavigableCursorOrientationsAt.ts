import { Node, NodeCategory, Span } from "../document-model-rd4";

import { NodeNavigator } from "./nodeNavigator";
import { PseudoNode } from "./pseudoNode";

function isEmptyInsertionPoint(node: PseudoNode): boolean {
  if (node instanceof Node) {
    if (node.nodeType.doesNotHaveChildren()) {
      return false;
    }
    return node.children?.length === 0;
  }
  return false;
}

function isInBetweenInsertionPoint(node: PseudoNode, adjacentSiblingNode?: PseudoNode): boolean {
  return (
    node instanceof Node &&
    node.nodeType.category === NodeCategory.Inline &&
    !(node instanceof Span) &&
    (!adjacentSiblingNode ||
      (adjacentSiblingNode instanceof Node &&
        adjacentSiblingNode.nodeType.category === NodeCategory.Inline &&
        !(adjacentSiblingNode instanceof Span)))
  );
}

export type GetNavigableCursorOrientationsAtResult = {
  before?: boolean;
  after?: boolean;
  on?: boolean;
};

const CannedGetNavigableCursorAffinitiesAtResult = {
  beforeAfter: { before: true, after: true } as GetNavigableCursorOrientationsAtResult,
  none: {},
};

export function getNavigableCursorOrientationsAt(navigator: NodeNavigator): GetNavigableCursorOrientationsAtResult {
  const el = navigator.tip.node;
  const precedingSibling = navigator.precedingSiblingNode;
  const nextSibling = navigator.nextSiblingNode;

  if (PseudoNode.isGraphemeOrFancyGrapheme(el)) {
    return CannedGetNavigableCursorAffinitiesAtResult.beforeAfter;
  } else {
    const hasOn =
      isEmptyInsertionPoint(el) ||
      (el instanceof Node && el.nodeType.category === NodeCategory.Inline && el.nodeType.doesNotHaveChildren());
    const hasBeforeBetweenInsertionPoint = isInBetweenInsertionPoint(el, precedingSibling);
    const hasAfterBetweenInsertionPoint = isInBetweenInsertionPoint(el, nextSibling);

    if (!hasOn && !hasBeforeBetweenInsertionPoint && !hasAfterBetweenInsertionPoint) {
      return CannedGetNavigableCursorAffinitiesAtResult.none;
    }
    if (!hasOn && hasBeforeBetweenInsertionPoint && hasAfterBetweenInsertionPoint) {
      return CannedGetNavigableCursorAffinitiesAtResult.beforeAfter;
    }

    const result: GetNavigableCursorOrientationsAtResult = {};
    if (hasBeforeBetweenInsertionPoint) {
      result.before = true;
    }
    if (hasOn) {
      result.on = true;
    }
    if (hasAfterBetweenInsertionPoint) {
      result.after = true;
    }
    return result;
  }
}
