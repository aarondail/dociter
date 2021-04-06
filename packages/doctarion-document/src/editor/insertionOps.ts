import * as immer from "immer";

import { Chain, Node, NodeNavigator, NodeThatContainsInlineContent, PathPart } from "../basic-traversal";
import { CursorAffinity, CursorNavigator, PositionClassification } from "../cursor";
import * as Models from "../models";

import { resetCursorMovementHints } from "./cursorOps";
import { deleteSelection } from "./deletionOps";
import { EditorState } from "./editor";
import { OperationError, OperationErrorCode } from "./error";
import { EditorServices } from "./services";
import { getCursorNavigatorAndValidate, ifLet, refreshNavigator } from "./utils";

const castDraft = immer.castDraft;

export const insertText = (text: string | Models.Text) => (
  state: immer.Draft<EditorState>,
  services: EditorServices
): void => {
  const codePoints = typeof text === "string" ? Models.Text.fromString(text) : text;

  if (state.selection) {
    deleteSelection(state);
  }
  resetCursorMovementHints(state);

  let nav = getCursorNavigatorAndValidate(state, services);
  const node = castDraft(nav.tip.node);

  switch (nav.classifyCurrentPosition()) {
    case PositionClassification.CodePoint:
      ifLet(Chain.getParentAndTipIfPossible(nav.chain), ([parent, tip]) => {
        if (!Node.containsText(parent.node)) {
          throw new Error(
            "Found a code point whole parent that apparently does not have text which should be impossible"
          );
        }

        const offset = state.cursor.affinity === CursorAffinity.Before ? 0 : 1;

        castDraft(parent.node.text).splice(PathPart.getIndex(tip.pathPart) + offset, 0, ...codePoints);
        for (let i = 0; i < codePoints.length; i++) {
          nav.navigateToNextCursorPosition();
        }
        state.cursor = castDraft(nav.cursor);
      });
      break;

    case PositionClassification.EmptyInsertionPoint:
      if (Node.containsText(node)) {
        node.text.push(...codePoints);
        nav.navigateToLastDescendantCursorPosition(); // Move to the last Code Point
        state.cursor = castDraft(nav.cursor);
      } else if (Node.containsInlineContent(node)) {
        const newParagraph = Models.InlineText.new(codePoints);
        node.content.push(castDraft(newParagraph));
        services.ids.assignId(newParagraph);
        nav.navigateToLastDescendantCursorPosition(); // Move into the InlineContent
        state.cursor = castDraft(nav.cursor);
      } else if (Node.isDocument(node)) {
        const newInline = Models.Block.paragraph(Models.InlineText.new(codePoints));
        node.blocks.push(castDraft(newInline));
        services.ids.assignId(newInline);
        nav.navigateToLastDescendantCursorPosition(); // Move to the last Code Point
        state.cursor = castDraft(nav.cursor);
      } else {
        throw new Error("Cursor is on an empty insertion point where there is no way to insert text somehow");
      }
      break;

    case PositionClassification.BeforeInBetweenInsertionPoint:
      ifLet(Chain.getParentAndTipIfPossible(nav.chain), ([parent, tip]) => {
        if (Node.containsInlineContent(parent.node)) {
          const newInline = Models.InlineText.new(codePoints);
          castDraft(parent.node.content).splice(PathPart.getIndex(tip.pathPart), 0, castDraft(newInline));
          services.ids.assignId(newInline);
          nav = refreshNavigator(nav);
          nav.navigateToLastDescendantCursorPosition();
          state.cursor = castDraft(nav.cursor);
        } else {
          throw new Error("Cursor is on an in-between insertion point where there is no way to inesrt text somehow");
        }
      });
      break;

    case PositionClassification.AfterInBetweenInsertionPoint:
      ifLet(Chain.getParentAndTipIfPossible(nav.chain), ([parent, tip]) => {
        if (Node.containsInlineContent(parent.node)) {
          const newInline = Models.InlineText.new(codePoints);
          castDraft(parent.node.content).splice(PathPart.getIndex(tip.pathPart) + 1, 0, castDraft(newInline));
          services.ids.assignId(newInline);
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
};

export const insertUrlLink = (inlineUrlLink: Models.InlineUrlLink) => (
  state: immer.Draft<EditorState>,
  services: EditorServices
): void => {
  if (state.selection) {
    deleteSelection(state);
  }
  resetCursorMovementHints(state);

  const startingNav = getCursorNavigatorAndValidate(state, services);

  let destinationInsertIndex: number | undefined;
  let destinationBlock: NodeThatContainsInlineContent | undefined;
  let destinationNavigator: NodeNavigator | undefined;

  switch (startingNav.classifyCurrentPosition()) {
    case PositionClassification.CodePoint:
      ifLet(Chain.getGrandParentToTipIfPossible(startingNav.chain), ([grandParent, parent, tip]) => {
        if (!Node.containsText(parent.node) || !Node.containsInlineContent(grandParent.node)) {
          throw new Error(
            "Found code point outside of a parent that contains text or a grand parent that contains inline content."
          );
        }

        if (!Node.isInlineText(parent.node)) {
          throw new Error("Cannot insert a URL link inside a non Inilne Text node.");
        }

        if (!tip.pathPart || !parent.pathPart) {
          throw new Error("Found a code point or inline text without a pathPart");
        }

        const index = PathPart.getIndex(tip.pathPart) + (state.cursor.affinity === CursorAffinity.Before ? 0 : 1);
        const shouldSplitText = index !== 0 && index < parent.node.text.length;
        if (shouldSplitText) {
          // Split the inline text node
          const [leftInlineText, rightInlineText] = Models.InlineText.split(parent.node, index);

          castDraft(grandParent.node.content).splice(
            PathPart.getIndex(parent.pathPart),
            1,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...castDraft([leftInlineText, rightInlineText])
          );
        }

        destinationInsertIndex =
          PathPart.getIndex(parent.pathPart) +
          (shouldSplitText ? 1 : state.cursor.affinity === CursorAffinity.Before ? 0 : 1);
        destinationBlock = grandParent.node;
        destinationNavigator = startingNav.toNodeNavigator();
        destinationNavigator.navigateToParent();
        destinationNavigator.navigateToParent();
      });
      break;

    case PositionClassification.EmptyInsertionPoint:
      if (Node.containsInlineContent(startingNav.tip.node)) {
        destinationInsertIndex = 0;
        destinationBlock = startingNav.tip.node;
        destinationNavigator = startingNav.toNodeNavigator();
      } else if (Node.isDocument(startingNav.tip.node)) {
        const p = Models.Block.paragraph();
        state.document.blocks.push(castDraft(p));
        destinationInsertIndex = 0;
        destinationBlock = p;
        destinationNavigator = startingNav.toNodeNavigator();
        destinationNavigator.navigateToChild(0);
      } else {
        throw new OperationError(
          OperationErrorCode.InvalidCursorPosition,
          "Must be inside a block that can contain inline URLs."
        );
      }
      break;
    case PositionClassification.BeforeInBetweenInsertionPoint:
    case PositionClassification.AfterInBetweenInsertionPoint:
      ifLet(Chain.getParentAndTipIfPossible(startingNav.chain), ([parent, tip]) => {
        if (Node.containsInlineContent(parent.node)) {
          destinationInsertIndex =
            PathPart.getIndex(tip.pathPart) + (state.cursor.affinity === CursorAffinity.Before ? 0 : 1);
          destinationBlock = parent.node;
          destinationNavigator = startingNav.toNodeNavigator();
          destinationNavigator.navigateToParent();
        } else {
          throw new OperationError(
            OperationErrorCode.InvalidCursorPosition,
            "Cannot insert inline url link in a between insertion point in a parent that cannot contain inlines."
          );
        }
      });
      break;
  } // switch

  if (destinationBlock !== undefined && destinationInsertIndex !== undefined && destinationNavigator !== undefined) {
    // And insert url link
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    castDraft(destinationBlock.content).splice(destinationInsertIndex, 0, castDraft(inlineUrlLink));
    services.ids.assignId(inlineUrlLink);

    // Update the cursor
    destinationNavigator.navigateToChild(destinationInsertIndex);
    const updatedCursorNav = new CursorNavigator(state.document);
    updatedCursorNav.navigateToUnchecked(destinationNavigator.path, CursorAffinity.Before);
    updatedCursorNav.navigateToLastDescendantCursorPosition();
    state.cursor = castDraft(updatedCursorNav.cursor);
  } else {
    throw new Error("Could not figure out how to insert url link");
  }
};
