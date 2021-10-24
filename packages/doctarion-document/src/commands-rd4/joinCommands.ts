import lodash from "lodash";

import { Node, NodeCategory } from "../document-model-rd4";
import { CursorNavigator, LiftingPathMap, Path, PseudoNode, Range } from "../traversal-rd4";
import { FlowDirection, ReadonlyWorkingNode } from "../working-document-rd4";

import { TargetPayload } from "./payloads";
import { coreCommand } from "./types";
import { CommandUtils } from "./utils";

interface JoinOptions {
  /**
   * Note for selections this doesn't affect which blocks will be joined, but it
   * does affect whether the children are joined into the first selected block,
   * or the last.
   */
  readonly direction: FlowDirection;
}

export type JoinPayload = TargetPayload & Partial<JoinOptions>;

export const join = coreCommand<JoinPayload>("join", (state, services, payload) => {
  const direction = payload.direction ?? FlowDirection.Backward;

  const targets = CommandUtils.selectTargets(state, payload.target);

  // Not really sure we need to do this... vs. just iterating through the
  // targets and processing them immediately
  const toJoin = new LiftingPathMap<{ readonly node: ReadonlyWorkingNode }>();

  for (const target of targets) {
    // Skip any interactor (or throw error) if the interactor is a selection (for now)
    if (target.selectionAnchorNavigator) {
      const [startNav, endNav] = target.isMainCursorFirst
        ? [target.mainAnchorNavigator, target.selectionAnchorNavigator]
        : [target.selectionAnchorNavigator, target.mainAnchorNavigator];
      const start = navigateUpToNonInline(startNav);
      const end = navigateUpToNonInline(endNav);
      if (!start || !end) {
        break;
      }

      new Range(start.path, end.path).walk(
        state.document,
        (n) => {
          // Skip the start block if we are going backwards, or the end block if
          // we are going forwards
          if (direction === FlowDirection.Backward && n.path.equalTo(start.path)) {
            // Skip
          } else if (direction === FlowDirection.Forward && n.path.equalTo(end.path)) {
            // Skip
          } else {
            toJoin.add(n.path, { node: n.tip.node as ReadonlyWorkingNode });
          }
        },
        nodeIsInlineOrGraphemeOrFancyGrapheme,
        nodeIsInlineOrGraphemeOrFancyGrapheme
      );
    } else {
      const n = navigateUpToNonInline(target.mainAnchorNavigator);
      if (n) {
        toJoin.add(n.path, { node: n.node });
      }
    }
  }

  for (const { elements } of lodash.reverse(toJoin.getAllOrderedByPaths())) {
    const sourceNode = elements[0]!.node;
    state.joinSiblingIntoNode(sourceNode, direction);
  }
});

function nodeIsInlineOrGraphemeOrFancyGrapheme(node: PseudoNode): boolean {
  return (
    PseudoNode.isGraphemeOrFancyGrapheme(node) ||
    (node instanceof Node && node.nodeType.category === NodeCategory.Inline)
  );
}

function navigateUpToNonInline(
  cursorNavigator: CursorNavigator
): { node: ReadonlyWorkingNode; path: Path } | undefined {
  const n = cursorNavigator.toNodeNavigator();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!nodeIsInlineOrGraphemeOrFancyGrapheme(n.tip.node)) {
      return { path: n.path, node: n.tip.node as ReadonlyWorkingNode };
    }
    if (!n.navigateToParent()) {
      return undefined;
    }
  }
}
