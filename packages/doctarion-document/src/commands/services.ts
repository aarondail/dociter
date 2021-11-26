import { Side } from "../miscUtils";
import { Chain, NodeNavigator } from "../traversal";
import { HorizontalVisualPosition } from "../working-document";

import { Command } from "./types";

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

export interface CommandServices {
  /**
   * Use this to execute (during an command) another related command.
   */
  readonly execute: <ReturnType>(command: Command<unknown, ReturnType, string>) => ReturnType;

  /**
   * The layout service doesn't layout nodes, rather it reports layout
   * information related to nodes.
   */
  readonly layout?: NodeLayoutService;
}
