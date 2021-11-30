import { Node, NodeCategory, NodeChildrenType, Paragraph, Span } from "../document-model";
import { FlowDirection } from "../shared-utils";
import { Text, TextStyleStrip } from "../text-model";
import { CursorOrientation, PseudoNode } from "../traversal";
import { InsertOrJoin, ReadonlyWorkingNode, WorkingDocument } from "../working-document";

import { deleteImplementation } from "./deletionCommands";
import { CommandError } from "./error";
import { TargetPayload } from "./payloads";
import { CommandServices } from "./services";
import { SplitType, split } from "./splitCommands";
import { coreCommand } from "./types";
import { CommandUtils, SelectTargetsResult, SelectTargetsSort } from "./utils";

interface InsertOptionsBase {
  readonly dontCreateNecessaryContainerNodes?: boolean;
}

interface InsertTextOptions extends InsertOptionsBase {
  // TODO support fancy text too!
  readonly text: string | Text;
}

interface InsertNodeOptions extends InsertOptionsBase {
  readonly node: Node;
}

type InsertOptions = InsertTextOptions | InsertNodeOptions;

export type InsertPayload = TargetPayload & InsertOptions;

export const insert = coreCommand<InsertPayload>("insert", (state, services, payload) => {
  const content: Text | Node =
    (payload as any).node ??
    (typeof (payload as any).text === "string" ? Text.fromString((payload as any).text) : (payload as any).text);

  const contentIsNode = content instanceof Node;
  const contentIsText = !contentIsNode;
  const contentIsInline = contentIsNode && content.nodeType.category === NodeCategory.Inline;
  const contentIsBlock = contentIsNode && content.nodeType.category === NodeCategory.Block;

  const targets = getTargetsForInsertionAndDeleteSelections(state, services, payload);

  for (const target of targets) {
    if (target.selectionAnchorNavigator) {
      throw new CommandError("Unexpectedly found a selection");
    }

    if (contentIsText) {
      insertTextPrime(state, target, content);
    } else if (contentIsInline) {
      insertInlinePrime(state, target, content);
    } else if (contentIsBlock) {
      insertBlockPrime(state, target, content, services);
    } else {
      throw new CommandError(`Cannot insert node of type ${content.nodeType.category}`);
    }
  }
});

function checkIfInsertionPositionOnGraphemeAndValidateParent(target: SelectTargetsResult): boolean {
  if (PseudoNode.isGrapheme(target.mainAnchorNavigator.tip.node)) {
    if (
      !target.mainAnchorNavigator.parent ||
      !PseudoNode.isNode(target.mainAnchorNavigator.parent.node) ||
      !CommandUtils.doesNodeTypeHaveTextOrFancyText(target.mainAnchorNavigator.parent.node.nodeType)
    ) {
      throw new CommandError(
        "Found a grapheme whose parent that apparently does not have text which should be impossible"
      );
    }
    return true;
  }
  return false;
}

function getTargetsForInsertionAndDeleteSelections(
  state: WorkingDocument,
  services: CommandServices,
  payload: TargetPayload
) {
  const targets = CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Reversed);

  // Delete selection first
  let anySelections = false;
  for (const target of targets) {
    if (target.selectionAnchorNavigator) {
      anySelections = true;
      // Delete a selection (this will turn it into a non-selection)
      services.execute(deleteImplementation({ target: { interactorId: target.interactor.id } }));
    }
  }

  return anySelections ? CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Reversed) : targets;
}

function insertBlockPrime(
  state: WorkingDocument,
  target: SelectTargetsResult,
  content: Node,
  services: CommandServices
) {
  const targetNode = target.mainAnchorNavigator.tip.node as ReadonlyWorkingNode;
  const targetPathPart = target.mainAnchorNavigator.tip.pathPart!;

  const findBlockResult = CommandUtils.findAncestorBlockNodeWithNavigator(target.mainAnchorNavigator);
  if (!findBlockResult) {
    // This is probably the document
    if (
      (targetNode instanceof Node && targetNode.nodeType.childrenType === NodeChildrenType.Blocks) ||
      targetNode.nodeType.childrenType === NodeChildrenType.BlocksAndSuperBlocks
    ) {
      state.insertNode(targetNode, content, 0);
      target.mainAnchorNavigator.navigateToLastDescendantCursorPosition();
      state.updateInteractor(target.interactor.id, {
        mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
        lineMovementHorizontalVisualPosition: undefined,
      });
      return;
    }
    throw new CommandError("Cannot figure out how to insert block at this location");
  }

  if (!(findBlockResult.node instanceof Node)) {
    throw new CommandError("Cannot figure out how to insert block at this location");
  }
  const blockNode: ReadonlyWorkingNode = findBlockResult.node;
  const blockContainerNode: ReadonlyWorkingNode = blockNode.parent!;

  const isAtEdge = CommandUtils.isCursorNavigatorAtEdgeOfContainingNode(
    target.mainAnchorNavigator,
    blockNode,
    targetPathPart?.index === 0 ? FlowDirection.Backward : FlowDirection.Forward
  );
  const isAtTrailingEdge = isAtEdge && targetPathPart?.index !== 0;

  let insertionIndex = blockNode.pathPartFromParent!.index || 0;
  const needToSplit = blockNode.children.length > 0 && !isAtEdge;

  if (needToSplit) {
    services.execute(split({ type: SplitType.Blocks, target: { interactorId: target.interactor.id } }));
    insertionIndex++;
  } else if (isAtTrailingEdge && blockNode.children.length !== 0) {
    insertionIndex++;
  }

  const tip = blockNode.pathPartFromParent!;
  state.insertNode(blockContainerNode, content, insertionIndex, tip.facet);

  if (needToSplit) {
    target.mainAnchorNavigator.navigateFreelyTo(state.getNodePath(blockNode), CursorOrientation.On);
    target.mainAnchorNavigator.navigateFreelyToNextSibling();
    target.mainAnchorNavigator.navigateFreelyToNextSibling();
    target.mainAnchorNavigator.navigateToNextCursorPosition();
    state.updateInteractor(target.interactor.id, {
      mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
      lineMovementHorizontalVisualPosition: undefined,
    });
  } else if (isAtTrailingEdge && blockNode.children.length !== 0) {
    target.mainAnchorNavigator.navigateFreelyTo(state.getNodePath(blockNode), CursorOrientation.On);
    target.mainAnchorNavigator.navigateFreelyToNextSibling();
    target.mainAnchorNavigator.navigateFreelyToNextSibling();
    target.mainAnchorNavigator.navigateToLastDescendantCursorPosition();
    state.updateInteractor(target.interactor.id, {
      mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
      lineMovementHorizontalVisualPosition: undefined,
    });
  }
}

function insertInlinePrime(state: WorkingDocument, target: SelectTargetsResult, content: Node) {
  const targetPathPart = target.mainAnchorNavigator.tip.pathPart!;
  const orientation = target.mainAnchorNavigator.cursor.orientation;

  if (checkIfInsertionPositionOnGraphemeAndValidateParent(target)) {
    // SCENARIO 1 - Target position is a Grapheme
    const parentNode = target.mainAnchorNavigator.parent!.node as ReadonlyWorkingNode;
    const grandParentNode = target.mainAnchorNavigator.grandParent!.node as ReadonlyWorkingNode;
    if (!grandParentNode || !(grandParentNode.nodeType.childrenType === NodeChildrenType.Inlines)) {
      throw new CommandError("Cant find place to insert node");
    }

    let parentIndexFromGrandParent = target.mainAnchorNavigator.parent!.pathPart!.index!;

    const isAtEdge = CommandUtils.isCursorNavigatorAtEdgeOfContainingNode(
      target.mainAnchorNavigator,
      parentNode,
      targetPathPart?.index === 0 ? FlowDirection.Backward : FlowDirection.Forward
    );

    if (isAtEdge) {
      // SCENARIO 1.a - Target position is a Grapheme, but at the edge of the inline
      parentIndexFromGrandParent = parentIndexFromGrandParent + (orientation === CursorOrientation.Before ? 0 : 1);

      const insertResult = state.insertNode(grandParentNode, content, parentIndexFromGrandParent);

      if (insertResult.insertionHandledBy === InsertOrJoin.Join) {
        // SCENARIO 1.a - Target position is a Grapheme, but at the edge of the inline and the insertion resulted in a Join
        if (parentNode.nodeType === Span) {
          // This only happens when inserting Spans that get auto-joined to other Spans
          let offset = targetPathPart.index! || -1; // For some reason, if the edge is the backward edge we need to subtract one to get the math to work
          offset += content.children.length;
          target.mainAnchorNavigator.navigateFreelyToParent();
          target.mainAnchorNavigator.navigateFreelyToChild(offset);
          target.mainAnchorNavigator.changeCursorOrientationFreely(CursorOrientation.On);
          target.mainAnchorNavigator.navigateToNextCursorPosition();
        } else {
          const offset = targetPathPart?.index;
          // This is like when we insert a Span to the edge of a Link (that got joined to a sibling span)
          target.mainAnchorNavigator.navigateFreelyToParent();
          target.mainAnchorNavigator.navigateFreelyToParent();
          if (offset === 0) {
            target.mainAnchorNavigator.navigateFreelyToChild(parentIndexFromGrandParent - 1);
            target.mainAnchorNavigator.navigateToLastDescendantCursorPosition();
          } else {
            target.mainAnchorNavigator.navigateFreelyToChild(parentIndexFromGrandParent);
            target.mainAnchorNavigator.navigateFreelyToChild(content.children.length - 1);
            target.mainAnchorNavigator.navigateToNextCursorPosition();
          }
        }
      } else {
        // SCENARIO 1.a - Target position is a Grapheme, but at the edge of the inline and the insertion was not a join
        target.mainAnchorNavigator.navigateFreelyToParent();
        target.mainAnchorNavigator.navigateFreelyToParent();
        target.mainAnchorNavigator.navigateFreelyToChild(parentIndexFromGrandParent);
        if ((target.mainAnchorNavigator.toNodeNavigator().nextSiblingNode as Node)?.nodeType === Span) {
          target.mainAnchorNavigator.changeCursorOrientationFreely(CursorOrientation.After);
          target.mainAnchorNavigator.navigateToNextCursorPosition();
        } else {
          target.mainAnchorNavigator.changeCursorOrientationFreely(CursorOrientation.On);
          target.mainAnchorNavigator.navigateToNextCursorPosition();
        }
      }

      state.updateInteractor(target.interactor.id, {
        mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
        lineMovementHorizontalVisualPosition: undefined,
      });
    } else {
      // SCENARIO 1.b - Target position is a Grapheme, but at not at the edge (so we have to split the inline)
      const insertionIndex =
        orientation === CursorOrientation.On
          ? targetPathPart.index! + 1
          : orientation === CursorOrientation.Before
          ? targetPathPart.index! + 0
          : targetPathPart.index! + 1;

      const insertResult = state.splitNodeAndInsertBetween(parentNode, [insertionIndex], content);

      if (insertResult.insertionHandledBy === InsertOrJoin.Join) {
        let offset = target.mainAnchorNavigator.tip.pathPart!.index!;
        offset += content.children.length;
        target.mainAnchorNavigator.navigateFreelyToParent();
        target.mainAnchorNavigator.navigateFreelyToChild(offset);
        target.mainAnchorNavigator.changeCursorOrientationFreely(CursorOrientation.On);
        target.mainAnchorNavigator.navigateToNextCursorPosition();
      } else {
        parentIndexFromGrandParent++;
        target.mainAnchorNavigator.navigateFreelyToParent();
        target.mainAnchorNavigator.navigateFreelyToParent();
        target.mainAnchorNavigator.navigateFreelyToChild(parentIndexFromGrandParent);
        if ((target.mainAnchorNavigator.toNodeNavigator().nextSiblingNode as Node)?.nodeType === Span) {
          target.mainAnchorNavigator.changeCursorOrientationFreely(CursorOrientation.After);
          target.mainAnchorNavigator.navigateToNextCursorPosition();
        } else if (content.nodeType === Span) {
          target.mainAnchorNavigator.navigateToLastDescendantCursorPosition();
        } else {
          target.mainAnchorNavigator.changeCursorOrientationFreely(CursorOrientation.On);
          target.mainAnchorNavigator.navigateToNextCursorPosition();
        }
      }

      state.updateInteractor(target.interactor.id, {
        mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
        lineMovementHorizontalVisualPosition: undefined,
      });
    }
  } else {
    // SCENARIO 2 - Target position is NOT a Grapheme, but a Node
    const targetNode = target.mainAnchorNavigator.tip.node as ReadonlyWorkingNode;
    const parentNode = target.mainAnchorNavigator.parent!.node as ReadonlyWorkingNode;

    if (CommandUtils.doesNodeTypeHaveTextOrFancyText(targetNode.nodeType)) {
      // SCENARIO 2.a - Inserting before or after an inline
      const insertionIndex =
        (targetPathPart?.index || 0) +
        (target.mainAnchorNavigator.cursor.orientation === CursorOrientation.After ? 1 : 0);

      const insertionResult = state.insertNode(parentNode, content, insertionIndex);

      target.mainAnchorNavigator.navigateFreelyToParent();
      target.mainAnchorNavigator.navigateFreelyToChild(
        insertionResult.insertionHandledBy === InsertOrJoin.Insert ? insertionIndex : insertionIndex - 1
      );

      if (content.nodeType === Span) {
        target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
      } else {
        target.mainAnchorNavigator.changeCursorOrientationFreely(CursorOrientation.On);
        target.mainAnchorNavigator.navigateToNextCursorPosition();
      }

      state.updateInteractor(target.interactor.id, {
        mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
        lineMovementHorizontalVisualPosition: undefined,
      });
    } else if (targetNode.nodeType.childrenType === NodeChildrenType.Inlines) {
      // SCENARIO 2.b - Inserting into a Block (that contains Inlines)
      state.insertNode(targetNode, content, 0);
      target.mainAnchorNavigator.navigateToLastDescendantCursorPosition();
      state.updateInteractor(target.interactor.id, {
        mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
        lineMovementHorizontalVisualPosition: undefined,
      });
    } else if (CommandUtils.doesNodeTypeHaveBlockChildren(targetNode.nodeType)) {
      // Empty document?
      const newParagraph = new Node(Paragraph, [], {});
      const insertionResult = state.insertNode(targetNode, newParagraph, 0);
      const actualNewParagraph = insertionResult.workingNode;
      const insertionIndex = 0; // Is this right?
      state.insertNode(actualNewParagraph, content, insertionIndex);

      target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
      state.updateInteractor(target.interactor.id, {
        mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
        lineMovementHorizontalVisualPosition: undefined,
      });
    } else {
      throw new CommandError("Cannot figure out how to insert inline at this location");
    }
  }
}

function insertTextPrime(state: WorkingDocument, target: SelectTargetsResult, content: Text) {
  if (checkIfInsertionPositionOnGraphemeAndValidateParent(target)) {
    // SCENARIO 1 - Target position is a Grapheme
    const targetPathPart = target.mainAnchorNavigator.tip.pathPart!;
    const parentNode = target.mainAnchorNavigator.parent!.node as ReadonlyWorkingNode;

    // Inserting text into a text container
    let offset;
    let moveAnchor;
    switch (target.mainAnchorNavigator.cursor.orientation) {
      case CursorOrientation.Before:
        offset = 0;
        moveAnchor = false; // Will get updated by insertText
        break;
      case CursorOrientation.After:
        offset = 1;
        moveAnchor = true; // Wont get updated by insertText since its after location
        break;
      case CursorOrientation.On:
        offset = 1;
        moveAnchor = false;
        break;
    }

    state.insertNodeText(parentNode, content, targetPathPart.index! + offset);

    // Insert text will update anchors on this node but if our orientation
    // is after it won't actually update the main anchor for the
    // interactor in this target
    if (moveAnchor) {
      for (let i = 0; i < content.length; i++) {
        target.mainAnchorNavigator.navigateToNextCursorPosition();
      }
      state.updateInteractor(target.interactor.id, {
        mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
        lineMovementHorizontalVisualPosition: undefined,
      });
    } else {
      state.updateInteractor(target.interactor.id, { lineMovementHorizontalVisualPosition: undefined });
    }
  } else {
    // SCENARIO 2 - Target position is NOT a Grapheme, but a Node
    const targetNode = target.mainAnchorNavigator.tip.node as ReadonlyWorkingNode;
    const targetPathPart = target.mainAnchorNavigator.tip.pathPart!;
    const parentNode = target.mainAnchorNavigator.parent?.node as ReadonlyWorkingNode | undefined;
    const orientation = target.mainAnchorNavigator.cursor.orientation;

    if (CommandUtils.doesNodeTypeHaveTextOrFancyText(targetNode.nodeType)) {
      // SCENARIO 2.a - Inserting into Inline node (inferred by the fact that it contains text)
      if (targetNode.children.length === 0 || orientation === CursorOrientation.On) {
        // SCENARIO 2.a.i - Inserting into empty inline or ON an inline
        state.insertNodeText(targetNode, content, 0);
        target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
        state.updateInteractor(target.interactor.id, {
          mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
          lineMovementHorizontalVisualPosition: undefined,
        });
      } else {
        // SCENARIO 2.a.ii - Inserting before or after an inline
        const insertionIndex =
          (targetPathPart?.index || 0) +
          (target.mainAnchorNavigator.cursor.orientation === CursorOrientation.After ? 1 : 0);

        const newSpan = new Node(Span, content, { styles: new TextStyleStrip() });
        // Note this may result in a merge with another sibling Span, so we have to check the insertionResult later
        const insertionResult = state.insertNode(parentNode!, newSpan, insertionIndex);

        target.mainAnchorNavigator.navigateFreelyToParent();
        target.mainAnchorNavigator.navigateFreelyToChild(
          insertionResult.insertionHandledBy === InsertOrJoin.Insert ? insertionIndex : insertionIndex - 1
        );
        target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
        state.updateInteractor(target.interactor.id, {
          mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
          lineMovementHorizontalVisualPosition: undefined,
        });
      }
    } else if (targetNode.nodeType.childrenType === NodeChildrenType.Inlines) {
      // SCENARIO 2.b - Inserting into a Block (that contains Inlines)

      const newSpan = new Node(Span, content, { styles: new TextStyleStrip() });
      const insertionIndex = 0;
      state.insertNode(targetNode, newSpan, insertionIndex);

      target.mainAnchorNavigator.navigateFreelyToChild(insertionIndex);
      target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme

      state.updateInteractor(target.interactor.id, {
        mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
        lineMovementHorizontalVisualPosition: undefined,
      });
    } else if (CommandUtils.doesNodeTypeHaveBlockChildren(targetNode.nodeType)) {
      // SCENARIO 2.c - Inserting into a node that contains Blocks

      const newParagraph = new Node(Paragraph, [], {});
      const insertionResult = state.insertNode(targetNode, newParagraph, 0);
      const actualNewParagraph = insertionResult.workingNode;
      const insertionIndex = 0; // Is this right?
      const newSpan = new Node(Span, content, { styles: new TextStyleStrip() });
      state.insertNode(actualNewParagraph, newSpan, insertionIndex);

      target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
      state.updateInteractor(target.interactor.id, {
        mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
        lineMovementHorizontalVisualPosition: undefined,
      });
    } else {
      throw new CommandError("Cannot figure out how to insert text at this location");
    }
  }
}
