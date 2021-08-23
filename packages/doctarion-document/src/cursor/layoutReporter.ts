import { Chain, NodeNavigator } from "../basic-traversal";
import { Side } from "../miscUtils";

export type HorizontalVisualPosition = number;

export interface NodeLayoutReporter {
  detectHorizontalDistanceFromTargetHorizontalAnchor(
    subject: NodeNavigator | Chain,
    subjectSide: Side,
    target: HorizontalVisualPosition
  ):
    | { distance: number; estimatedSubjectSiblingsToTarget?: number; estimatedSubjectSiblingSideClosestToTarget?: Side }
    | undefined;

  detectLineWrapOrBreakBetweenNodes(
    preceding: NodeNavigator | Chain,
    subsequent: NodeNavigator | Chain
  ): boolean | undefined;

  getTargetHorizontalAnchor(target: NodeNavigator | Chain, side: Side): HorizontalVisualPosition | undefined;
}
