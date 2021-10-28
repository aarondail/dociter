import { Inline, Node, Paragraph, Span } from "../document-model-rd4";
import { Text } from "../text-model-rd4";
import { CursorOrientation, PseudoNode } from "../traversal-rd4";
import { ReadonlyWorkingNode } from "../working-document-rd4";

import { deleteImplementation } from "./deletionCommands";
import { CommandError } from "./error";
import { Direction, TargetPayload } from "./payloads";
import { coreCommand } from "./types";
import { CommandUtils } from "./utils";

interface InsertOptionsBase {
  readonly dontCreateNecessaryContainerNodes?: boolean;
}

interface InsertTextOptions extends InsertOptionsBase {
  readonly text: string | Text;
}

interface InsertInlineOption extends InsertOptionsBase {
  readonly inline: Inline;
}

type InsertOptions = InsertTextOptions | InsertInlineOption;

export type InsertPayload = TargetPayload & InsertOptions;

export const insert = coreCommand<InsertPayload>("insert", (state, services, payload) => {
  const isText = isInsertOptionsText(payload);

  // TODO sorting..
  let targets = CommandUtils.selectTargets(state, payload.target, true);
  targets.reverse();

  // Delete selection first
  let anySelections = false;
  for (const target of targets) {
    if (target.selectionAnchorNavigator) {
      anySelections = true;
      // Delete a selection (this will turn it into a non-selection)
      services.execute(deleteImplementation({ target: { interactorId: target.interactor.id } }));
    }
  }

  targets = anySelections ? CommandUtils.selectTargets(state, payload.target, true) : targets;
  targets.reverse();

  for (const target of targets) {
    if (target.selectionAnchorNavigator) {
      throw new CommandError("Unexpectedly found a selection");
    }
    const node = target.mainAnchorNavigator.tip.node;

    const direction = Direction.Forward; // payload.direction || FlowDirection.Backward;
    const isForward = direction === Direction.Forward;

    const currentPositionIsOnGrapheme = PseudoNode.isGraphemeOrFancyGrapheme(node);

    if (currentPositionIsOnGrapheme) {
      if (
        !target.mainAnchorNavigator.parent ||
        !(target.mainAnchorNavigator.parent.node instanceof Node) ||
        !target.mainAnchorNavigator.parent.node.nodeType.hasTextOrFancyTextChildren()
      ) {
        throw new CommandError(
          "Found a grapheme whole parent that apparently does not have text which should be impossible"
        );
      }

      if (isText) {
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
            moveAnchor = true; // Wont get updated by insertText since its before location
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
        if (!grandParentNode || !CommandUtils.isPseudoNodeAnInlineContainer(grandParentNode)) {
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
      const isEmptyInsertionPoint = node instanceof Node && node.nodeType.hasNodeChildren();
      const insertionIndex =
        target.mainAnchorNavigator.cursor.orientation === CursorOrientation.On
          ? // direction === FlowDirection.Backward ? target.mainAnchorNavigator.tip.pathPart.index + 0 :
            target.mainAnchorNavigator.tip.pathPart!.index! + 1
          : target.mainAnchorNavigator.cursor.orientation === CursorOrientation.Before
          ? target.mainAnchorNavigator.tip.pathPart!.index! + 0
          : target.mainAnchorNavigator.tip.pathPart!.index! + 1;

      if (CommandUtils.isPseudoNodeATextOrFancyTextContainer(node)) {
        if (isText && isEmptyInsertionPoint) {
          const graphemes: Text = typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text;
          // Empty inline text or inline url link
          state.insertNodeText(node, graphemes, 0);
          target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        } else {
          // Similar to above...
          const inline = isText
            ? new Span(typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text)
            : payload.inline;
          const parent = target.mainAnchorNavigator.parent?.node;
          if (!parent || !CommandUtils.isPseudoNodeAnInlineContainer(parent)) {
            throw new CommandError("Can not insert Span into non-Inline container");
          }

          state.insertNode(parent as ReadonlyWorkingNode, inline, insertionIndex);

          target.mainAnchorNavigator.navigateFreelyToParent();
          target.mainAnchorNavigator.navigateFreelyToChild(insertionIndex);
          target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        }
      } else if (CommandUtils.isPseudoNodeAnInlineContainer(node)) {
        if (isText && isEmptyInsertionPoint) {
          const graphemes: Text = typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text;
          // Empty block that contains inlines
          const newInline = new Span(graphemes);
          state.insertNode(node, newInline, 0);

          // Move into the InlineText
          target.mainAnchorNavigator.navigateToLastDescendantCursorPosition();
          state.updateInteractor(target.interactor.id, {
            mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        } else {
          // Similar to above...
          const inline = isText
            ? new Span(typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text)
            : payload.inline;

          state.insertNode(node as ReadonlyWorkingNode, inline, insertionIndex);

          target.mainAnchorNavigator.navigateFreelyToChild(insertionIndex);
          target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        }
      } else if (CommandUtils.isPseudoNodeABlockContainer(node)) {
        // Empty document
        const newParagraph = new Paragraph([]);
        const newParagraphId = state.insertNode(node as ReadonlyWorkingNode, newParagraph, 0);

        if (isText && isEmptyInsertionPoint) {
          const graphemes: Text = typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text;
          const newInline = new Span(graphemes);
          state.insertNode(newParagraphId, newInline, 0);

          target.mainAnchorNavigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            mainAnchor: state.getAnchorParametersFromCursorNavigator(target.mainAnchorNavigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        } else {
          // Similar to above...
          const inline = isText
            ? new Span(typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text)
            : payload.inline;
          state.insertNode(newParagraphId, inline, insertionIndex);

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
