import { Chain, NodeNavigator } from "../basic-traversal";

import { Side } from "./side";

export type HorizontalVisualAnchor = number;

export interface NodeLayoutReporter {
  detectHorizontalDistanceFromTargetHorizontalAnchor(
    subject: NodeNavigator | Chain,
    subjectSide: Side,
    target: HorizontalVisualAnchor
  ):
    | { distance: number; estimatedSubjectSiblingsToTarget?: number; estimatedSubjectSiblingSideClosestToTarget?: Side }
    | undefined;

  detectLineWrapOrBreakBetweenNodes(
    preceding: NodeNavigator | Chain,
    subsequent: NodeNavigator | Chain
  ): boolean | undefined;

  getTargetHorizontalAnchor(target: NodeNavigator | Chain, side: Side): HorizontalVisualAnchor | undefined;
}
