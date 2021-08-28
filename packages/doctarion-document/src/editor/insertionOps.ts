import lodash from "lodash";

import { CursorOrientation } from "../cursor";
import { Document, InlineText, NodeUtils, ParagraphBlock, Text } from "../document-model";

import { delete_ } from "./deletionOps";
import { createCoreOperation } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { TargetPayload } from "./payloads";
import { selectTargets } from "./utils";

interface InsertTextOptions {
  readonly allowCreationOfNewInlineTextAndParagrahs?: boolean;

  // treat other orientation on positions like replacements

  readonly text: string | Text;
  }

export type InsertTextPayload = TargetPayload & InsertTextOptions;

export const insertText = createCoreOperation<InsertTextPayload>("insert/text", (state, services, payload) => {
  const graphemes = typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text;

  let targets = selectTargets(state, services, payload.target);

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

  targets = anySelections ? selectTargets(state, services, payload.target) : targets;

  for (const target of lodash.reverse(targets)) {
    if (target.isSelection) {
      throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState);
    }
    const node = target.navigator.tip.node;

    // Text in a text container
  if (NodeUtils.isGrapheme(node)) {
      if (!target.navigator.parent || !NodeUtils.isTextContainer(target.navigator.parent.node)) {
        throw new Error("Found a grapheme whole parent that apparently does not have text which should be impossible");
      }

      const offset = target.navigator.cursor.orientation === CursorOrientation.Before ? 0 : 1;
      state.insertText(target.navigator.parent.node, target.navigator.tip.pathPart.index + offset, graphemes);

      // Insert text will update anchors on this node but if our orientation is
      // after it won't actually update the main anchor for the interactor in
      // this target
      if (target.navigator.cursor.orientation === CursorOrientation.After) {
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
      return;
    }

    if (!payload.allowCreationOfNewInlineTextAndParagrahs) {
      continue;
    }

    if (target.navigator.cursor.orientation === CursorOrientation.On) {
      // Insertion points
      if (NodeUtils.getChildren(node)?.length === 0) {
    if (NodeUtils.isTextContainer(node)) {
          // Empty inline text or inline url link
          state.insertText(node, 0, graphemes);
          target.navigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
            lineMovementHorizontalVisualPosition: undefined,
      });
          return;
    } else if (NodeUtils.isInlineContainer(node)) {
          // Empty block that contains inlines
      const newInline = new InlineText(graphemes);
          state.insertInline(node, 0, newInline);

          // Move into the InlineText
          target.navigator.navigateToLastDescendantCursorPosition();
          state.updateInteractor(target.interactor.id, {
            to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
            lineMovementHorizontalVisualPosition: undefined,
      });
          return;
    } else if (node instanceof Document) {
          // Empty document
          const newParagraph = new ParagraphBlock();
          const newParagraphId = state.insertBlock(node, 0, newParagraph);
      const newInline = new InlineText(graphemes);
          state.insertInline(newParagraphId, 0, newInline);

          target.navigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
          state.updateInteractor(target.interactor.id, {
            to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
        lineMovementHorizontalVisualPosition: undefined,
      });
          return;
        }
      }
      // Something other than an insertion point but when the cursor position is on? Maybe treat like a selection?

      throw new EditorOperationError(
        EditorOperationErrorCode.InvalidCursorPosition,
        "Cannot insert text at this position"
      );
    } else {
      if (target.navigator.parent && NodeUtils.isInlineContainer(target.navigator.parent.node)) {
        const index =
          target.navigator.tip.pathPart.index +
          (target.navigator.cursor.orientation === CursorOrientation.Before ? 0 : 1);

        const newInline = new InlineText(graphemes);
        state.insertInline(target.navigator.parent.node, index, newInline);

        // Move into the InlineText
        target.navigator.navigateFreeformToParent();
        target.navigator.navigateFreeformToChild(index);
        target.navigator.navigateToLastDescendantCursorPosition();

        state.updateInteractor(target.interactor.id, {
          to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
          lineMovementHorizontalVisualPosition: undefined,
        });
        return;
      }

      throw new EditorOperationError(
        EditorOperationErrorCode.InvalidCursorPosition,
        "Cannot insert text at this position"
      );
      }
  }
});

export const insertUrlLink = createCoreOperation<InlineUrlLink>("insert/urlLink", (state, services, payload): void => {
  if (state.getAllInteractors()[0].isSelection) {
    services.execute(state, delete_({ target: { interactorId: state.getAllInteractors()[0].id } }));
  }
  state.updateInteractor(state.getAllInteractors()[0].id, {
    lineMovementHorizontalVisualPosition: undefined,
  });

  const startingNav = getCursorNavigatorAndValidate(state, services, 0);

  let destinationInsertIndex: number | undefined;
  let destinationBlock: InlineContainingNode | undefined;
  let destinationNavigator: NodeNavigator | undefined;

  if (NodeUtils.isGrapheme(startingNav.tip.node)) {
    ifLet(startingNav.chain.getGrandParentToTipIfPossible(), ([grandParent, parent, tip]) => {
      if (!NodeUtils.isTextContainer(parent.node) || !NodeUtils.isInlineContainer(grandParent.node)) {
        throw new Error(
          "Found grapheme outside of a parent that contains text or a grand parent that contains inline content."
        );
      }

      if (!(parent.node instanceof InlineText)) {
        throw new Error("Cannot insert a URL link inside a non Inline Text node.");
      }

      if (!tip.pathPart || !parent.pathPart) {
        throw new Error("Found a grapheme or inline text without a pathPart");
      }

      const index = tip.pathPart.index + (startingNav.cursor.orientation === CursorOrientation.Before ? 0 : 1);
      const shouldSplitText = index !== 0 && index < parent.node.text.length;
      if (shouldSplitText) {
        // Split the inline text node
        const [leftInlineText, rightInlineText] = parent.node.split(index);
        state.processNodeDeleted(parent.node);
        state.processNodeCreated(leftInlineText, grandParent.node);
        state.processNodeCreated(rightInlineText, grandParent.node);

        castDraft(grandParent.node.children).splice(
          parent.pathPart.index,
          1,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...castDraft([leftInlineText, rightInlineText])
        );
      }

      destinationInsertIndex =
        parent.pathPart.index +
        (shouldSplitText ? 1 : startingNav.cursor.orientation === CursorOrientation.Before ? 0 : 1);
      destinationBlock = grandParent.node;
      destinationNavigator = startingNav.toNodeNavigator();
      destinationNavigator.navigateToParent();
      destinationNavigator.navigateToParent();
    });
  } else if (NodeUtils.getChildren(startingNav.tip.node)?.length === 0) {
    if (NodeUtils.isInlineContainer(startingNav.tip.node)) {
      destinationInsertIndex = 0;
      destinationBlock = startingNav.tip.node;
      destinationNavigator = startingNav.toNodeNavigator();
    } else if (startingNav.tip.node instanceof Document) {
      const p = new ParagraphBlock();
      state.processNodeCreated(p, state.document);
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
  } else if (
    startingNav.cursor.orientation === CursorOrientation.Before ||
    startingNav.cursor.orientation === CursorOrientation.After
  ) {
    ifLet(startingNav.chain.getParentAndTipIfPossible(), ([parent, tip]) => {
      if (NodeUtils.isInlineContainer(parent.node)) {
        destinationInsertIndex =
          tip.pathPart.index + (startingNav.cursor.orientation === CursorOrientation.Before ? 0 : 1);
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
  }

  if (destinationBlock !== undefined && destinationInsertIndex !== undefined && destinationNavigator !== undefined) {
    // And insert url link
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    castDraft(destinationBlock.children).splice(destinationInsertIndex, 0, castDraft(payload));
    state.processNodeCreated(payload, destinationBlock);

    // Update the cursor
    destinationNavigator.navigateToChild(destinationInsertIndex);
    const updatedCursorNav = new CursorNavigator(state.document, services.layout);
    updatedCursorNav.navigateFreeformTo(destinationNavigator.path, CursorOrientation.Before);
    updatedCursorNav.navigateToLastDescendantCursorPosition();

    state.updateInteractor(state.getAllInteractors()[0].id, {
      to: services.interactors.cursorNavigatorToAnchorPosition(updatedCursorNav),
      selectTo: undefined,
      lineMovementHorizontalVisualPosition: undefined,
    });
  } else {
    throw new Error("Could not figure out how to insert url link");
  }
});
