import { Node, NodeChildrenType, Paragraph, Span } from "../document-model-rd5";
import { FlowDirection } from "../miscUtils";
import { Text, TextStyleStrip } from "../text-model-rd4";
import { CursorOrientation, PseudoNode } from "../traversal-rd4";
import { ReadonlyWorkingNode } from "../working-document-rd4";

import { deleteImplementation } from "./deletionCommands";
import { CommandError } from "./error";
import { TargetPayload } from "./payloads";
import { coreCommand } from "./types";
import { CommandUtils, SelectTargetsSort } from "./utils";

interface InsertOptionsBase {
  readonly dontCreateNecessaryContainerNodes?: boolean;
}

interface InsertTextOptions extends InsertOptionsBase {
  readonly text: string | Text;
}

interface InsertInlineOption extends InsertOptionsBase {
  readonly inline: Node;
}

type InsertOptions = InsertTextOptions | InsertInlineOption;

export type InsertPayload = TargetPayload & InsertOptions;

export const insert = coreCommand<InsertPayload>("insert", (state, services, payload) => {
  const payloadIsText = isInsertOptionsText(payload);

  let targets = CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Reversed);

  // Delete selection first
  let anySelections = false;
  for (const target of targets) {
    if (target.selectionAnchorNavigator) {
      anySelections = true;
      // Delete a selection (this will turn it into a non-selection)
      services.execute(deleteImplementation({ target: { interactorId: target.interactor.id } }));
    }
  }

  targets = anySelections ? CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Reversed) : targets;

  for (const target of targets) {
    if (target.selectionAnchorNavigator) {
      throw new CommandError("Unexpectedly found a selection");
    }
    const targetNode = target.mainAnchorNavigator.tip.node;

    const direction = FlowDirection.Forward;
    const isForward = direction === FlowDirection.Forward;

    const currentPositionIsOnGrapheme = PseudoNode.isGrapheme(targetNode);

    if (currentPositionIsOnGrapheme) {
      if (
        !target.mainAnchorNavigator.parent ||
        !PseudoNode.isNode(target.mainAnchorNavigator.parent.node) ||
        !CommandUtils.doesNodeTypeHaveTextOrFancyText(target.mainAnchorNavigator.parent.node.nodeType)
      ) {
        throw new CommandError(
          "Found a grapheme whole parent that apparently does not have text which should be impossible"
        );
      }

      if (payloadIsText) {
        const graphemes: Text = typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text;

        // Text in a text container
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
            // TODO test
            offset = isForward ? 1 : 0;
            moveAnchor = false;
            break;
        }

        state.insertNodeText(
          target.mainAnchorNavigator.parent.node,
          graphemes,
          target.mainAnchorNavigator.tip.pathPart!.index! + offset
        );

        // Insert text will update anchors on this node but if our orientation
        // is after it won't actually update the main anchor for the
        // interactor in this target
        if (moveAnchor) {
          for (let i = 0; i < graphemes.length; i++) {
            target.mainAnchorNavigator.navigateToNextCursorPosition();
          }
          state.updateInteractor(target.interactor.id, {
            mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        } else {
          state.updateInteractor(target.interactor.id, { lineMovementHorizontalVisualPosition: undefined });
        }
        // DONE
      } else {
        // This case is where the cursor/anchor is on a grapheme but we are
        // inserting an inline
        const grandParentNode = target.mainAnchorNavigator.grandParent!.node as ReadonlyWorkingNode;
        if (!grandParentNode || !(grandParentNode.nodeType.childrenType === NodeChildrenType.Inlines)) {
          throw new CommandError("Cant find place to insert inline");
        }

        let parentIndexFromGrandParent = target.mainAnchorNavigator.parent.pathPart!.index!;

        const isAtEdge = CommandUtils.isCursorNavigatorAtEdgeOfContainingNode(
          target.mainAnchorNavigator,
          target.mainAnchorNavigator.parent.node,
          direction
        );

        if (isAtEdge) {
          parentIndexFromGrandParent =
            target.mainAnchorNavigator.cursor.orientation === CursorOrientation.On
              ? // direction === FlowDirection.Backward ? parentIndexFromGrandParent + 0 :
                parentIndexFromGrandParent + 1
              : target.mainAnchorNavigator.cursor.orientation === CursorOrientation.Before
              ? parentIndexFromGrandParent + 0
              : parentIndexFromGrandParent + 1;

          state.insertNode(grandParentNode, payload.inline, parentIndexFromGrandParent);

          target.mainAnchorNavigator.navigateFreelyToParent();
          target.mainAnchorNavigator.navigateFreelyToParent();
          target.mainAnchorNavigator.navigateFreelyToChild(parentIndexFromGrandParent);
          target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        } else {
          // Split
          const insertionIndex =
            target.mainAnchorNavigator.cursor.orientation === CursorOrientation.On
              ? // ? direction === FlowDirection.Backward ? target.mainAnchorNavigator.tip.pathPart.index + 0 :
                target.mainAnchorNavigator.tip.pathPart!.index! + 1
              : target.mainAnchorNavigator.cursor.orientation === CursorOrientation.Before
              ? target.mainAnchorNavigator.tip.pathPart!.index! + 0
              : target.mainAnchorNavigator.tip.pathPart!.index! + 1;

          state.splitNode(target.mainAnchorNavigator.parent.node, [insertionIndex]);

          // Then do insertion like above
          state.insertNode(grandParentNode, payload.inline, parentIndexFromGrandParent + 1);
          parentIndexFromGrandParent++;

          target.mainAnchorNavigator.navigateFreelyToParent();
          target.mainAnchorNavigator.navigateFreelyToParent();
          target.mainAnchorNavigator.navigateFreelyToChild(parentIndexFromGrandParent);
          target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        }
      }
    } else {
      // Current position is NOT a Grapheme, but a Node

      const insertionIndex =
        target.mainAnchorNavigator.tip.pathPart?.index === undefined
          ? 0
          : target.mainAnchorNavigator.cursor.orientation === CursorOrientation.On
          ? // direction === FlowDirection.Backward ? target.mainAnchorNavigator.tip.pathPart.index + 0 :
            target.mainAnchorNavigator.tip.pathPart.index + 1
          : target.mainAnchorNavigator.cursor.orientation === CursorOrientation.Before
          ? target.mainAnchorNavigator.tip.pathPart.index + 0
          : target.mainAnchorNavigator.tip.pathPart.index + 1;

      if (targetNode instanceof Node && CommandUtils.doesNodeTypeHaveTextOrFancyText(targetNode.nodeType)) {
        if (payloadIsText && targetNode.children.length === 0) {
          const graphemes: Text = typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text;
          // Empty Span or other inline
          state.insertNodeText(targetNode, graphemes, 0);
          target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        } else {
          // Similar to above...
          const inline = payloadIsText
            ? new Node(Span, typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text, {
                styles: new TextStyleStrip(),
              })
            : payload.inline;
          const parent = target.mainAnchorNavigator.parent?.node;
          if (!parent || !(parent instanceof Node) || !(parent.nodeType.childrenType === NodeChildrenType.Inlines)) {
            throw new CommandError("Can not insert Span into non-Inline container");
          }

          state.insertNode(parent, inline, insertionIndex);

          target.mainAnchorNavigator.navigateFreelyToParent();
          target.mainAnchorNavigator.navigateFreelyToChild(insertionIndex);
          target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        }
      } else if (targetNode instanceof Node && targetNode.nodeType.childrenType === NodeChildrenType.Inlines) {
        if (payloadIsText && targetNode.children.length === 0) {
          const graphemes: Text = typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text;
          // Empty block that contains inlines
          const newInline = new Node(Span, graphemes, { styles: new TextStyleStrip() });
          state.insertNode(targetNode, newInline, 0);

          // Move into the InlineText
          target.mainAnchorNavigator.navigateToLastDescendantCursorPosition();
          state.updateInteractor(target.interactor.id, {
            mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        } else {
          // Similar to above...
          const inline = payloadIsText
            ? new Node(Span, typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text, {
                styles: new TextStyleStrip(),
              })
            : payload.inline;

          state.insertNode(targetNode, inline, insertionIndex);

          target.mainAnchorNavigator.navigateFreelyToChild(insertionIndex);
          target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        }
      } else if (targetNode instanceof Node && CommandUtils.doesNodeTypeHaveBlockChildren(targetNode.nodeType)) {
        // Empty document?
        const newParagraph = new Node(Paragraph, [], {});
        const insertionResult = state.insertNode(targetNode, newParagraph, 0);
        const actualNewParagraph = insertionResult.workingNode;

        if (payloadIsText && targetNode.children.length === 0) {
          const graphemes: Text = typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text;
          const newInline = new Node(Span, graphemes, { styles: new TextStyleStrip() });
          state.insertNode(actualNewParagraph, newInline, 0);

          target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        } else {
          // Similar to above...
          const inline = payloadIsText
            ? new Node(
                Span,
                typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text,

                { styles: new TextStyleStrip() }
              )
            : payload.inline;
          state.insertNode(actualNewParagraph, inline, insertionIndex);

          target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        }
      }
    }
  }
});

function isInsertOptionsText(options: InsertOptions): options is InsertTextOptions {
  return ((options as unknown) as InsertTextOptions).text !== undefined;
}
