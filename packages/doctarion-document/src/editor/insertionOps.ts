import lodash from "lodash";

import { CursorOrientation } from "../cursor";
import { Block, Document, Inline, InlineText, NodeUtils, ParagraphBlock, Text } from "../document-model";
import { FlowDirection } from "../working-document";

import { delete_ } from "./deletionOps";
import { createCoreOperation } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { TargetPayload } from "./payloads";
import { isNavigatorAtEdgeOfBlock, isNavigatorAtEdgeOfTextContainer, selectTargets } from "./utils";

interface InsertOptionsBase {
  readonly allowCreationOfNewInlineTextAndParagrahsIfNeeded?: boolean;
  /**
   * Backwards (default) mean effectively the insertion doesn't change the
   * interactor's position, though the content is inserted in the order it is
   * supplied (its not reversed or anything). Forwards (normal) means the
   * interactor moves to be at the end of the inserted content.
   */
  readonly direction?: FlowDirection;
}

interface InsertTextOptions extends InsertOptionsBase {
  readonly text: string | Text;
}

interface InsertInlineOptions extends InsertOptionsBase {
  readonly inlines: readonly Inline[];
}

interface InsertBlockOptions extends InsertOptionsBase {
  readonly blocks: readonly Block[];
}

type InsertOptions = InsertTextOptions | InsertInlineOptions | InsertBlockOptions;

export type InsertPayload = TargetPayload & InsertOptions;

export const insert = createCoreOperation<InsertPayload>("insert", (state, services, payload) => {
  const isText = isInsertOptionsText(payload);
  const isBlock = !isText && isInsertOptionsBlock(payload);

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

    const direction = payload.direction || FlowDirection.Backward;
    const isForward = direction === FlowDirection.Forward;

    const currentPositionIsOnGrapheme = NodeUtils.isGrapheme(node);

    // The cases not covered are: before or after the Document or a Block. On a
    // grapheme is covered by first boolean actually.

    // If the direction is before, which is the 99% case, the node is inserted
    // before the cursor/anchor position and the cursor/anchor is moved to the
    // end of the inserted content. If the direction is after then the content
    // is inserted after the cursor/anchor position and the cursor/anchor is
    // kept in the same position. At least that is how is should appear.
    //
    // When the cursor/anchor orientation is "On" the same thing happens w.r.t.
    // the "Before" and "After" cases as described above, but the location of
    // the insertion may be more wildly different. I.e. the position in the doc
    // where the inserted content goes can be far away from each other.

    if (!isBlock) {
      // Inlines or Text
      if (currentPositionIsOnGrapheme) {
        if (!target.navigator.parent || !NodeUtils.isTextContainer(target.navigator.parent.node)) {
          throw new Error(
            "Found a grapheme whole parent that apparently does not have text which should be impossible"
          );
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
          const inlines: readonly Inline[] = payload.inlines;
          let parentIndexFromGrandParent = target.navigator.parent.pathPart.index;

          const atEdge = isNavigatorAtEdgeOfTextContainer(target.navigator, direction);
          if (atEdge) {
            parentIndexFromGrandParent =
              target.navigator.cursor.orientation === CursorOrientation.On
                ? direction === FlowDirection.Backward
                  ? parentIndexFromGrandParent + 0
                  : parentIndexFromGrandParent + 1
                : target.navigator.cursor.orientation === CursorOrientation.Before
                ? parentIndexFromGrandParent + 0
                : parentIndexFromGrandParent + 1;

            for (const i of inlines) {
              state.insertInline(grandParentNode, parentIndexFromGrandParent, i);
              parentIndexFromGrandParent++;
            }
            target.navigator.navigateFreeformToParent();
            target.navigator.navigateFreeformToParent();
            target.navigator.navigateFreeformToChild(parentIndexFromGrandParent - 1);
            target.navigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
            state.updateInteractor(target.interactor.id, {
              to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
              lineMovementHorizontalVisualPosition: undefined,
            });
          } else {
            // Split
            const insertionIndex =
              target.navigator.cursor.orientation === CursorOrientation.On
                ? direction === FlowDirection.Backward
                  ? target.navigator.tip.pathPart.index + 0
                  : target.navigator.tip.pathPart.index + 1
                : target.navigator.cursor.orientation === CursorOrientation.Before
                ? target.navigator.tip.pathPart.index + 0
                : target.navigator.tip.pathPart.index + 1;

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            state.splitNode(state.getId(target.navigator.parent.node)!, [insertionIndex]);

            // Then do insertion like above
            for (const i of inlines) {
              state.insertInline(grandParentNode, parentIndexFromGrandParent + 1, i);
              parentIndexFromGrandParent++;
            }

            target.navigator.navigateFreeformToParent();
            target.navigator.navigateFreeformToParent();
            target.navigator.navigateFreeformToChild(parentIndexFromGrandParent);
            target.navigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
            state.updateInteractor(target.interactor.id, {
              to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
              lineMovementHorizontalVisualPosition: undefined,
            });
          }
          // DONE
        }
      } else {
        // THIS should be if the current element is empty
        // if c is doc and empty add paragraph block, then either inline or inlinetext with text DONE
        // if c is non-empty inline and
        // if c is empty inline and insertion is text add empty inlinetext DONE
        // if c is doc and NOT empty move to last (or first cursor position) then add inline or inlinetext with text DONE
        // maybe calc destination, whether or not we need to insert stuff, and insert stuff... split if necessary?

        const isEmptyInsertionPoint = !NodeUtils.hasSomeChildren(node);
        const insertionIndex =
          target.navigator.cursor.orientation === CursorOrientation.On
            ? direction === FlowDirection.Backward
              ? target.navigator.tip.pathPart.index + 0
              : target.navigator.tip.pathPart.index + 1
            : target.navigator.cursor.orientation === CursorOrientation.Before
            ? target.navigator.tip.pathPart.index + 0
            : target.navigator.tip.pathPart.index + 1;

        if (NodeUtils.isTextContainer(node)) {
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
            const inlines: readonly Inline[] = isText
              ? [new InlineText(typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text)]
              : payload.inlines;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const parent = target.navigator.parent?.node;
            if (!parent || !NodeUtils.isInlineContainer(parent)) {
              throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState);
            }

            let i = insertionIndex;
            for (const inline of inlines) {
              state.insertInline(parent, i, inline);
              i++;
            }

            target.navigator.navigateFreeformToParent();
            target.navigator.navigateFreeformToChild(i - 1);
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
            const inlines: readonly Inline[] = isText
              ? [new InlineText(typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text)]
              : payload.inlines;
            let i = insertionIndex;
            for (const inline of inlines) {
              state.insertInline(node, i, inline);
              i++;
            }

            target.navigator.navigateFreeformToChild(i - 1);
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
            const inlines: readonly Inline[] = isText
              ? [new InlineText(typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text)]
              : payload.inlines;
            let i = insertionIndex;
            for (const inline of inlines) {
              state.insertInline(newParagraphId, i, inline);
              i++;
            }

            target.navigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
            state.updateInteractor(target.interactor.id, {
              to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
              lineMovementHorizontalVisualPosition: undefined,
            });
          }
        }
      }
    } else {
      // Block
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const blocks: readonly Block[] = payload.blocks;

      // eslint-disable-next-line @typescript-eslint/unbound-method
      const blockContainerSubChain = target.navigator.chain.searchBackwardsForSubChain(NodeUtils.isBlockContainer);

      const blockContainerNode = blockContainerSubChain?.[0]?.node;
      const blockNode = blockContainerSubChain?.[1]?.node;
      let blockIndex = blockContainerSubChain?.[1]?.pathPart.index;

      if (
        blockContainerNode === undefined ||
        !NodeUtils.isBlockContainer(blockContainerNode) ||
        blockIndex === undefined ||
        blockNode === undefined
      ) {
        throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState);
      }

      const atEdge = isNavigatorAtEdgeOfBlock(target.navigator, direction);
      if (atEdge) {
        for (const b of blocks) {
          state.insertBlock(blockContainerNode, blockIndex, b);
          blockIndex++;
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const splitChildIndices = blockContainerSubChain!.slice(2).map((x) => x.pathPart.index);
        if (
          target.navigator.cursor.orientation === CursorOrientation.After ||
          (target.navigator.cursor.orientation === CursorOrientation.On && direction === FlowDirection.Forward)
        ) {
          splitChildIndices[splitChildIndices.length - 1]++;
        }
        // Split
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        state.splitNode(state.getId(blockNode)!, splitChildIndices);

        // Then do insertion like above
        for (const b of blocks) {
          state.insertBlock(blockContainerNode, blockIndex, b);
          blockIndex++;
        }
      }
      // At edge of block? yes -> insert block before or after block
      // no well... split blokc/inline/text,
      //     may  xform new block (post split)
    }
  }
});

// export const insertOld = createCoreOperation<InsertPayload>("insert", (state, services, payload) => {
//   const graphemes = typeof payload.text === "string" ? Text.fromString(payload.text) : payload.text;

//   let targets = selectTargets(state, services, payload.target);

//   // Delete selection first
//   let anySelections = false;
//   for (const target of lodash.reverse(targets)) {
//     if (target.isSelection) {
//       anySelections = true;
//       // Delete a selection (this will turn it into a non-selection)
//       services.execute(
//         state,
//         delete_({
//           target: { interactorId: target.interactor.id },
//         })
//       );
//     }
//   }

//   targets = anySelections ? selectTargets(state, services, payload.target) : targets;

//   for (const target of lodash.reverse(targets)) {
//     if (target.isSelection) {
//       throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState);
//     }
//     const node = target.navigator.tip.node;

//     // Text in a text container
//     if (NodeUtils.isGrapheme(node)) {
//       if (!target.navigator.parent || !NodeUtils.isTextContainer(target.navigator.parent.node)) {
//         throw new Error("Found a grapheme whole parent that apparently does not have text which should be impossible");
//       }

//       const offset = target.navigator.cursor.orientation === CursorOrientation.Before ? 0 : 1;
//       state.insertText(target.navigator.parent.node, target.navigator.tip.pathPart.index + offset, graphemes);

//       // Insert text will update anchors on this node but if our orientation is
//       // after it won't actually update the main anchor for the interactor in
//       // this target
//       if (target.navigator.cursor.orientation === CursorOrientation.After) {
//         for (let i = 0; i < graphemes.length; i++) {
//           target.navigator.navigateToNextCursorPosition();
//         }
//         state.updateInteractor(target.interactor.id, {
//           to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
//           lineMovementHorizontalVisualPosition: undefined,
//         });
//       } else {
//         state.updateInteractor(target.interactor.id, { lineMovementHorizontalVisualPosition: undefined });
//       }
//       return;
//     }

//     if (!payload.allowCreationOfNewInlineTextAndParagrahsIfNeeded) {
//       continue;
//     }

//     if (target.navigator.cursor.orientation === CursorOrientation.On) {
//       // Insertion points
//       if (NodeUtils.getChildren(node)?.length === 0) {
//         if (NodeUtils.isTextContainer(node)) {
//           // Empty inline text or inline url link
//           state.insertText(node, 0, graphemes);
//           target.navigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
//           state.updateInteractor(target.interactor.id, {
//             to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
//             lineMovementHorizontalVisualPosition: undefined,
//           });
//           return;
//         } else if (NodeUtils.isInlineContainer(node)) {
//           // Empty block that contains inlines
//           const newInline = new InlineText(graphemes);
//           state.insertInline(node, 0, newInline);

//           // Move into the InlineText
//           target.navigator.navigateToLastDescendantCursorPosition();
//           state.updateInteractor(target.interactor.id, {
//             to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
//             lineMovementHorizontalVisualPosition: undefined,
//           });
//           return;
//         } else if (node instanceof Document) {
//           // Empty document
//           const newParagraph = new ParagraphBlock();
//           const newParagraphId = state.insertBlock(node, 0, newParagraph);
//           const newInline = new InlineText(graphemes);
//           state.insertInline(newParagraphId, 0, newInline);

//           target.navigator.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
//           state.updateInteractor(target.interactor.id, {
//             to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
//             lineMovementHorizontalVisualPosition: undefined,
//           });
//           return;
//         }
//       }
//       // Something other than an insertion point but when the cursor position is on? Maybe treat like a selection?

//       throw new EditorOperationError(
//         EditorOperationErrorCode.InvalidCursorPosition,
//         "Cannot insert text at this position"
//       );
//     } else {
//       if (target.navigator.parent && NodeUtils.isInlineContainer(target.navigator.parent.node)) {
//         const index =
//           target.navigator.tip.pathPart.index +
//           (target.navigator.cursor.orientation === CursorOrientation.Before ? 0 : 1);

//         const newInline = new InlineText(graphemes);
//         state.insertInline(target.navigator.parent.node, index, newInline);

//         // Move into the InlineText
//         target.navigator.navigateFreeformToParent();
//         target.navigator.navigateFreeformToChild(index);
//         target.navigator.navigateToLastDescendantCursorPosition();

//         state.updateInteractor(target.interactor.id, {
//           to: services.interactors.cursorNavigatorToAnchorPosition(target.navigator),
//           lineMovementHorizontalVisualPosition: undefined,
//         });
//         return;
//       }

//       throw new EditorOperationError(
//         EditorOperationErrorCode.InvalidCursorPosition,
//         "Cannot insert text at this position"
//       );
//     }
//   }
// });

function isInsertOptionsText(options: InsertOptions): options is InsertTextOptions {
  return ((options as unknown) as InsertTextOptions).text !== undefined;
}

function isInsertOptionsBlock(options: InsertOptions): options is InsertBlockOptions {
  return ((options as unknown) as InsertBlockOptions).blocks !== undefined;
}
