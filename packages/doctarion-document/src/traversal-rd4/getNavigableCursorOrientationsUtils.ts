import { Node, NodeCategory, NodeChildrenType, Span } from "../document-model-rd5";

import { CursorOrientation } from "./cursorPath";
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

function hasBeforeInBetweenInsertionPoint(
  node: PseudoNode,
  priorSiblingNode?: PseudoNode
): CursorOrientationClassification | undefined {
  if (node instanceof Node && node.nodeType.category === NodeCategory.Inline) {
    if (node.nodeType === Span) {
      return CursorOrientationClassification.PreferForward;
    } else {
      if (!priorSiblingNode) {
        return CursorOrientationClassification.Valid;
      }
      if (priorSiblingNode instanceof Node) {
        if (priorSiblingNode.nodeType === Span) {
          return CursorOrientationClassification.PreferBackward;
        } else {
          return CursorOrientationClassification.Valid;
        }
      }
      return undefined;
    }
  }
}

function hasAfterInBetweenInsertionPoint(
  node: PseudoNode,
  nextSiblingNode?: PseudoNode
): CursorOrientationClassification | undefined {
  if (node instanceof Node && node.nodeType.category === NodeCategory.Inline) {
    if (node.nodeType === Span) {
      if (nextSiblingNode && nextSiblingNode instanceof Node && nextSiblingNode.nodeType === Span) {
        return CursorOrientationClassification.PreferForward;
      } else {
        return CursorOrientationClassification.PreferBackward;
      }
    } else {
      if (!nextSiblingNode) {
        return CursorOrientationClassification.Valid;
      }
      if (nextSiblingNode instanceof Node) {
        if (nextSiblingNode.nodeType === Span) {
          return CursorOrientationClassification.PreferForward;
        } else {
          return CursorOrientationClassification.Valid;
        }
      }
      return undefined;
    }
  }
}

export enum CursorOrientationClassification {
  Valid = "VALID",
  PreferBackward = "PREFER_BACKWARD",
  PreferForward = "PREFER_FORWARD",
}

export type GetNavigableCursorOrientationsAtResult = { [key in CursorOrientation]?: boolean };

export type GetDetailedNavigableCursorOrientationsAtResult = {
  [key in CursorOrientation]?: CursorOrientationClassification;
};

export function getDetailedNavigableCursorOrientationsAt(
  navigator: NodeNavigator
): GetDetailedNavigableCursorOrientationsAtResult {
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
      ? { BEFORE: CursorOrientationClassification.Valid, AFTER: CursorOrientationClassification.Valid }
      : { AFTER: CursorOrientationClassification.Valid };
  }

  // OK the Node is NOT a Grapheme...
  const hasOn = isEmptyInsertionPoint(el);
  const hasBeforeBetweenInsertionPoint = hasBeforeInBetweenInsertionPoint(el, precedingSibling);
  const hasAfterBetweenInsertionPoint = hasAfterInBetweenInsertionPoint(el, nextSibling);

  if (!hasOn && !hasBeforeBetweenInsertionPoint && !hasAfterBetweenInsertionPoint) {
    return {};
  }

  const result: GetDetailedNavigableCursorOrientationsAtResult = {};
  // In this case we dont set before to true because ... we know after is true
  // on the preceding sibling... and we want to prefer after orientations for
  // these insertion positions... I think?
  result.BEFORE = precedingSibling ? undefined : hasBeforeBetweenInsertionPoint;
  if (hasOn) {
    result.ON = CursorOrientationClassification.Valid;
  }
  result.AFTER = hasAfterBetweenInsertionPoint;
  return result;
}

export function getNavigableCursorOrientationsAt(navigator: NodeNavigator): GetNavigableCursorOrientationsAtResult {
  const preResult = getDetailedNavigableCursorOrientationsAt(navigator);
  return {
    BEFORE: preResult.BEFORE === CursorOrientationClassification.Valid,
    ON: preResult.ON === CursorOrientationClassification.Valid,
    AFTER: preResult.AFTER === CursorOrientationClassification.Valid,
  };
}
