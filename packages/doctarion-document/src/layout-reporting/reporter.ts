import { Chain, NodeNavigator } from "../basic-traversal";

import { Side } from "./side";

export type HorizontalAnchor = number;

export interface NodeLayoutReporter {
  detectHorizontalDistanceFromTargetHorizontalAnchor(
    subject: NodeNavigator | Chain,
    subjectSide: Side,
    target: HorizontalAnchor
  ): { distance: number; estimatedSubjectSiblingsToTarget?: number } | undefined;

  detectLineWrapOrBreakBetweenNodes(
    preceeding: NodeNavigator | Chain,
    subsequent: NodeNavigator | Chain
  ): boolean | undefined;

  getTargetHorizontalAnchor(target: NodeNavigator | Chain, side: Side): HorizontalAnchor | undefined;
}
