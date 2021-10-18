import { Chain, NodeNavigator } from "../basic-traversal-rd4";
import { Side } from "../miscUtils";

export type HorizontalVisualPosition = number;

export interface NodeLayoutService {
  detectHorizontalDistanceFrom(
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

  getTargetHorizontalPosition(target: NodeNavigator | Chain, side: Side): HorizontalVisualPosition | undefined;
}
