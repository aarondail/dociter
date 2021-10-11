import lodash from "lodash";

import { CursorOrientation } from "../cursor";
import { Document, Inline, InlineEmoji, InlineText, NodeUtils, ParagraphBlock, Text } from "../document-model";
import { FlowDirection } from "../working-document";

import { delete_ } from "./deletionOps";
import { createCoreOperation } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { TargetPayload } from "./payloads";
import { isNavigatorAtEdgeOfTextContainer, selectTargets } from "./utils";

interface InsertOptionsBase {
  readonly allowCreationOfNewInlineTextAndParagrahsIfNeeded?: boolean;
  /**
   * Backwards (not default) mean effectively the insertion doesn't change the
   * interactor's position, though the content is inserted in the order it is
   * supplied (its not reversed or anything). Forwards (default) means the
   * interactor moves to be at the end of the inserted content.
   */
  // readonly direction?: FlowDirection;
}

interface InsertTextOptions extends InsertOptionsBase {
  readonly text: string | Text;
}

interface InsertInlineOption extends InsertOptionsBase {
  readonly inline: Inline;
}

type InsertOptions = InsertTextOptions | InsertInlineOption;

export type InsertPayload = TargetPayload & InsertOptions;

export const insert = createCoreOperation<InsertPayload>("insert", (state, services, payload) => {
  const isText = isInsertOptionsText(payload);

  let targets = selectTargets(state, services, payload.target, true);

  // Delete selection first
  let anySelections = false;
  for (const target of lodash.reverse(targets)) {
    if (target.isSelection) {
      anySelections = true;
      // Delete a selection (this will turn it into a non-selection)
      services.execute(
        state,
        delete_({
          target: { interactorId: target.interactor.id },
        })
      );
    }
  }

  targets = anySelections ? selectTargets(state, services, payload.target, true) : targets;

  for (const target of lodash.reverse(targets)) {
    if (target.isSelection) {
      throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState);
    }
    const node = target.navigator.tip.node;

    const direction = FlowDirection.Forward; // payload.direction || FlowDirection.Backward;
    const isForward = direction === FlowDirection.Forward;

    const currentPositionIsOnGrapheme = NodeUtils.isGrapheme(node);

    if (currentPositionIsOnGrapheme) {
      if (!target.navigator.parent || !NodeUtils.isTextContainer(target.navigator.parent.node)) {
        throw new Error("Found a grapheme whole parent that apparently does not have text which should be impossible");
      }

      if (isText) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const graphemes: Text = typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text;

        // Text in a text container
        let offset;
        let moveAnchor;
        switch (target.navigator.cursor.orientation) {
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

        state.insertText(target.navigator.parent.node, target.navigator.tip.pathPart.index + offset, graphemes);

        // Insert text will update anchors on this node but if our orientation
        // is after it won't actually update the main anchor for the
        // interactor in this target
        if (moveAnchor) {
          for (let i = 0; i < graphemes.length; i++) {
            target.navigator.navigateToNextCursorPosition();
          }
          state.updateInteractor(target.interactor.id, {
            to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        } else {
          state.updateInteractor(target.interactor.id, { lineMovementHorizontalVisualPosition: undefined });
        }
        // DONE
      } else {
        // This case is where the cursor/anchor is on a grapheme but we are
        // inserting an inline (not a block, not text)
        const grandParentNode = target.navigator.grandParent?.node;
        if (!grandParentNode || !NodeUtils.isInlineContainer(grandParentNode)) {
          throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState);
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        let parentIndexFromGrandParent = target.navigator.parent.pathPart.index;

        const atEdge = isNavigatorAtEdgeOfTextContainer(target.navigator, direction);
        if (atEdge) {
          parentIndexFromGrandParent =
            target.navigator.cursor.orientation === CursorOrientation.On
              ? // direction === FlowDirection.Backward ? parentIndexFromGrandParent + 0 :
                parentIndexFromGrandParent + 1
              : target.navigator.cursor.orientation === CursorOrientation.Before
              ? parentIndexFromGrandParent + 0
              : parentIndexFromGrandParent + 1;

          state.insertInline(grandParentNode, parentIndexFromGrandParent, payload.inline);

          target.navigator.navigateFreeformToParent();
          target.navigator.navigateFreeformToParent();
          target.navigator.navigateFreeformToChild(parentIndexFromGrandParent);
          target.navigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        } else {
          // Split
          const insertionIndex =
            target.navigator.cursor.orientation === CursorOrientation.On
              ? // ? direction === FlowDirection.Backward ? target.navigator.tip.pathPart.index + 0 :
                target.navigator.tip.pathPart.index + 1
              : target.navigator.cursor.orientation === CursorOrientation.Before
              ? target.navigator.tip.pathPart.index + 0
              : target.navigator.tip.pathPart.index + 1;

          state.splitNode(state.getId(target.navigator.parent.node)!, [insertionIndex]);

          // Then do insertion like above
          state.insertInline(grandParentNode, parentIndexFromGrandParent + 1, payload.inline);
          parentIndexFromGrandParent++;

          target.navigator.navigateFreeformToParent();
          target.navigator.navigateFreeformToParent();
          target.navigator.navigateFreeformToChild(parentIndexFromGrandParent);
          target.navigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        }
      }
    } else {
      const isEmptyInsertionPoint = !NodeUtils.hasSomeChildren(node);
      const insertionIndex =
        target.navigator.cursor.orientation === CursorOrientation.On
          ? // direction === FlowDirection.Backward ? target.navigator.tip.pathPart.index + 0 :
            target.navigator.tip.pathPart.index + 1
          : target.navigator.cursor.orientation === CursorOrientation.Before
          ? target.navigator.tip.pathPart.index + 0
          : target.navigator.tip.pathPart.index + 1;

      if (node instanceof InlineEmoji) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const inline = isText
          ? new InlineText(typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text)
          : payload.inline;
        const parent = target.navigator.parent?.node;
        if (!parent || !NodeUtils.isInlineContainer(parent)) {
          throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState);
        }

        state.insertInline(parent, insertionIndex, inline);

        target.navigator.navigateFreeformToParent();
        target.navigator.navigateFreeformToChild(insertionIndex);
        target.navigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
        state.updateInteractor(target.interactor.id, {
          to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
          lineMovementHorizontalVisualPosition: undefined,
        });
      } else if (NodeUtils.isTextContainer(node)) {
        if (isText && isEmptyInsertionPoint) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const graphemes: Text = typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text;
          // Empty inline text or inline url link
          state.insertText(node, 0, graphemes);
          target.navigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        } else {
          // Similar to above...
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const inline = isText
            ? new InlineText(typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text)
            : payload.inline;
          const parent = target.navigator.parent?.node;
          if (!parent || !NodeUtils.isInlineContainer(parent)) {
            throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState);
          }

          state.insertInline(parent, insertionIndex, inline);

          target.navigator.navigateFreeformToParent();
          target.navigator.navigateFreeformToChild(insertionIndex);
          target.navigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        }
      } else if (NodeUtils.isInlineContainer(node)) {
        if (isText && isEmptyInsertionPoint) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const graphemes: Text = typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text;
          // Empty block that contains inlines
          const newInline = new InlineText(graphemes);
          state.insertInline(node, 0, newInline);

          // Move into the InlineText
          target.navigator.navigateToLastDescendantCursorPosition();
          state.updateInteractor(target.interactor.id, {
            to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        } else {
          // Similar to above...
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const inline = isText
            ? new InlineText(typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text)
            : payload.inline;

          state.insertInline(node, insertionIndex, inline);

          target.navigator.navigateFreeformToChild(insertionIndex);
          target.navigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        }
      } else if (node instanceof Document) {
        // Empty document
        const newParagraph = new ParagraphBlock();
        const newParagraphId = state.insertBlock(node, 0, newParagraph);

        if (isText && isEmptyInsertionPoint) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const graphemes: Text = typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text;
          const newInline = new InlineText(graphemes);
          state.insertInline(newParagraphId, 0, newInline);

          target.navigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
            lineMovementHorizontalVisualPosition: undefined,
          });
        } else {
          // Similar to above...
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const inline = isText
            ? new InlineText(typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text)
            : payload.inline;
          state.insertInline(newParagraphId, insertionIndex, inline);

          target.navigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
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
