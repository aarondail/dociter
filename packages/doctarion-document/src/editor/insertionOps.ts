import * as immer from "immer";

import { NodeNavigator } from "../basic-traversal";
import { CursorAffinity, CursorNavigator, PositionClassification } from "../cursor";
import { Document, InlineContainingNode, InlineText, InlineUrlLink, NodeUtils, ParagraphBlock, Text } from "../models";

import { createCoreCommonOperation } from "./coreOperations";
import { deleteSelection } from "./deletionOps";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { getCursorNavigatorAndValidate, ifLet, refreshNavigator, resetCursorMovementHints } from "./utils";

const castDraft = immer.castDraft;

export const insertText = createCoreCommonOperation<string | Text>(
  "insert/text",
  ({ state, services, payload }): void => {
    const graphemes = typeof payload === "string" ? Text.fromString(payload) : payload;

    if (state.selection) {
      deleteSelection.run(state, services);
    }

    let nav = getCursorNavigatorAndValidate(state, services);
    const node = castDraft(nav.tip.node);

    switch (nav.classifyCurrentPosition()) {
      case PositionClassification.Grapheme:
        ifLet(nav.chain.getParentAndTipIfPossible(), ([parent, tip]) => {
          if (!NodeUtils.isTextContainer(parent.node)) {
            throw new Error(
              "Found a grapheme whole parent that apparently does not have text which should be impossible"
            );
          }

          const offset = nav.cursor.affinity === CursorAffinity.Before ? 0 : 1;

          castDraft(parent.node.text).splice(tip.pathPart.index + offset, 0, ...graphemes);
          for (let i = 0; i < graphemes.length; i++) {
            nav.navigateToNextCursorPosition();
          }
          state.cursor = castDraft(nav.cursor);
        });
        break;

      case PositionClassification.EmptyInsertionPoint:
        if (NodeUtils.isTextContainer(node)) {
          castDraft(node.text).push(...graphemes);
          nav.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.cursor = castDraft(nav.cursor);
        } else if (NodeUtils.isInlineContainer(node)) {
          const newInline = new InlineText(graphemes);
          castDraft(node.children).push(castDraft(newInline));
          services.tracking.register(newInline, node);
          nav.navigateToLastDescendantCursorPosition(); // Move into the InlineContent
          state.cursor = castDraft(nav.cursor);
        } else if (node instanceof Document) {
          const newInline = new InlineText(graphemes);
          const newParagraph = new ParagraphBlock(newInline);
          services.tracking.register(newParagraph, node);
          services.tracking.register(newInline, newParagraph);
          castDraft(node.children).push(castDraft(newParagraph));
          nav.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.cursor = castDraft(nav.cursor);
        } else {
          throw new Error("Cursor is on an empty insertion point where there is no way to insert text somehow");
        }
        break;

      case PositionClassification.BeforeInBetweenInsertionPoint:
        ifLet(nav.chain.getParentAndTipIfPossible(), ([parent, tip]) => {
          if (NodeUtils.isInlineContainer(parent.node)) {
            const newInline = new InlineText(graphemes);
            castDraft(parent.node.children).splice(tip.pathPart.index, 0, castDraft(newInline));
            services.tracking.register(newInline, node);
            nav = refreshNavigator(nav);
            nav.navigateToLastDescendantCursorPosition();
            state.cursor = castDraft(nav.cursor);
          } else {
            throw new Error("Cursor is on an in-between insertion point where there is no way to inesrt text somehow");
          }
        });
        break;

      case PositionClassification.AfterInBetweenInsertionPoint:
        ifLet(nav.chain.getParentAndTipIfPossible(), ([parent, tip]) => {
          if (NodeUtils.isInlineContainer(parent.node)) {
            const newInline = new InlineText(graphemes);
            castDraft(parent.node.children).splice(tip.pathPart.index + 1, 0, castDraft(newInline));
            services.tracking.register(newInline, node);
            nav.navigateToNextSiblingLastDescendantCursorPosition();
            state.cursor = castDraft(nav.cursor);
          } else {
            throw new Error("Cursor is on an in-between insertion point where there is no way to inesrt text somehow");
          }
        });
        break;
      default:
        throw new Error("Cursor is at a position where text cannot be inserted");
    }
  }
);

export const insertUrlLink = createCoreCommonOperation<InlineUrlLink>(
  "insert/urlLink",
  ({ state, services, payload }): void => {
    if (state.selection) {
      deleteSelection.run(state, services);
    }
    resetCursorMovementHints(state);

    const startingNav = getCursorNavigatorAndValidate(state, services);

    let destinationInsertIndex: number | undefined;
    let destinationBlock: InlineContainingNode | undefined;
    let destinationNavigator: NodeNavigator | undefined;

    switch (startingNav.classifyCurrentPosition()) {
      case PositionClassification.Grapheme:
        ifLet(startingNav.chain.getGrandParentToTipIfPossible(), ([grandParent, parent, tip]) => {
          if (!NodeUtils.isTextContainer(parent.node) || !NodeUtils.isInlineContainer(grandParent.node)) {
            throw new Error(
              "Found grapheme outside of a parent that contains text or a grand parent that contains inline content."
            );
          }

          if (!(parent.node instanceof InlineText)) {
            throw new Error("Cannot insert a URL link inside a non Inilne Text node.");
          }

          if (!tip.pathPart || !parent.pathPart) {
            throw new Error("Found a grapheme or inline text without a pathPart");
          }

          const index = tip.pathPart.index + (startingNav.cursor.affinity === CursorAffinity.Before ? 0 : 1);
          const shouldSplitText = index !== 0 && index < parent.node.text.length;
          if (shouldSplitText) {
            // Split the inline text node
            const [leftInlineText, rightInlineText] = parent.node.split(index);
            services.tracking.unregister(parent.node);
            services.tracking.register(leftInlineText, grandParent.node);
            services.tracking.register(rightInlineText, grandParent.node);

            castDraft(grandParent.node.children).splice(
              parent.pathPart.index,
              1,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...castDraft([leftInlineText, rightInlineText])
            );
          }

          destinationInsertIndex =
            parent.pathPart.index +
            (shouldSplitText ? 1 : startingNav.cursor.affinity === CursorAffinity.Before ? 0 : 1);
          destinationBlock = grandParent.node;
          destinationNavigator = startingNav.toNodeNavigator();
          destinationNavigator.navigateToParent();
          destinationNavigator.navigateToParent();
        });
        break;

      case PositionClassification.EmptyInsertionPoint:
        if (NodeUtils.isInlineContainer(startingNav.tip.node)) {
          destinationInsertIndex = 0;
          destinationBlock = startingNav.tip.node;
          destinationNavigator = startingNav.toNodeNavigator();
        } else if (startingNav.tip.node instanceof Document) {
          const p = new ParagraphBlock();
          services.tracking.register(p, state.document);
          castDraft(state.document.children).push(castDraft(p));
          destinationInsertIndex = 0;
          destinationBlock = p;
          destinationNavigator = startingNav.toNodeNavigator();
          destinationNavigator.navigateToChild(0);
        } else {
          throw new EditorOperationError(
            EditorOperationErrorCode.InvalidCursorPosition,
            "Must be inside a block that can contain inline URLs."
          );
        }
        break;
      case PositionClassification.BeforeInBetweenInsertionPoint:
      case PositionClassification.AfterInBetweenInsertionPoint:
        ifLet(startingNav.chain.getParentAndTipIfPossible(), ([parent, tip]) => {
          if (NodeUtils.isInlineContainer(parent.node)) {
            destinationInsertIndex =
              tip.pathPart.index + (startingNav.cursor.affinity === CursorAffinity.Before ? 0 : 1);
            destinationBlock = parent.node;
            destinationNavigator = startingNav.toNodeNavigator();
            destinationNavigator.navigateToParent();
          } else {
            throw new EditorOperationError(
              EditorOperationErrorCode.InvalidCursorPosition,
              "Cannot insert inline url link in a between insertion point in a parent that cannot contain inlines."
            );
          }
        });
        break;
    } // switch

    if (destinationBlock !== undefined && destinationInsertIndex !== undefined && destinationNavigator !== undefined) {
      // And insert url link
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      castDraft(destinationBlock.children).splice(destinationInsertIndex, 0, castDraft(payload));
      services.tracking.register(payload, destinationBlock);

      // Update the cursor
      destinationNavigator.navigateToChild(destinationInsertIndex);
      const updatedCursorNav = new CursorNavigator(state.document);
      updatedCursorNav.navigateToUnchecked(destinationNavigator.path, CursorAffinity.Before);
      updatedCursorNav.navigateToLastDescendantCursorPosition();
      state.cursor = castDraft(updatedCursorNav.cursor);
    } else {
      throw new Error("Could not figure out how to insert url link");
    }
  }
);

// TODO make sure we regsiter/unregstier/notifyMove in here
