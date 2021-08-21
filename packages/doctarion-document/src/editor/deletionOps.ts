import * as immer from "immer";
import lodash from "lodash";

import { NodeNavigator, Path, PathString } from "../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation, ReadonlyCursorNavigator } from "../cursor";
import { InlineEmoji, InlineText, NodeUtils } from "../models";
import { NodeAssociatedData } from "../working-document";

import { Anchor } from "./anchor";
import { InteractorAnchorType } from "./interactor";
import { InteractorAnchorDeletionHelper } from "./interactorAnchorDeletionHelper";
import { joinBlocks } from "./joinOps";
import { createCoreOperation } from "./operation";
import { TargetPayload } from "./payloads";
import { EditorOperationServices } from "./services";
import { FlowDirection, getRangeForSelection, selectTargets } from "./utils";

const castDraft = immer.castDraft;

interface DeleteAtOptions {
  /**
   * By default when an interactor is positioned around
   * an InlineEmoji the deletion will be a no-op because the deletion
   * does not affect nodes w/ different parents. If this is set to true, then
   * the deletion (of the adjacent InlineEmoji) will occur.
   */
  readonly allowAdjacentInlineEmojiDeletion: boolean;
  /**
   * By default when an interactor is positioned on an edge (so to speak)
   * between two InlineText's the deletion will be a no-op because the deletion
   * does not affect nodes w/ different parents. If this is set to true, then
   * the deletion (of the grapheme in the sibling InlineText) will occur.
   */
  readonly allowAdjacentInlineTextDeletion: boolean;
  /**
   * By default when an interactor is positioned somewhere where the next node
   * to delete has a different parent node (e.g., the interactor is positioned
   * before the first grapheme in an `InlineText`), the deletion is a no-op. If
   * this is set to true, no deletion will happen but the interactor will be
   * moved to the next logical cursor position. Note that for cross InlineText
   * cases, `allowAdjacentInlineTextDeletion`  takes precedence over this.
   */
  readonly allowMovementInBoundaryCases: boolean;
  /**
   * In cases where the cursor is at the edge of a block, deletion can be made
   * to instead behave like a joining operation.
   */
  readonly allowJoiningBlocksInBoundaryCases: boolean;
  readonly direction: FlowDirection;
  readonly dontThrowOnSelectionInteractors: boolean;
}

export type DeleteAtPayload = TargetPayload & Partial<DeleteAtOptions>;

export const deleteAt = createCoreOperation<DeleteAtPayload>("delete/at", (state, services, payload) => {
  const options: DeleteAtOptions = {
    allowAdjacentInlineEmojiDeletion: payload.allowAdjacentInlineEmojiDeletion ?? false,
    allowAdjacentInlineTextDeletion: payload.allowAdjacentInlineTextDeletion ?? false,
    allowMovementInBoundaryCases: payload.allowMovementInBoundaryCases ?? false,
    allowJoiningBlocksInBoundaryCases: payload.allowJoiningBlocksInBoundaryCases ?? false,
    direction: payload.direction ?? FlowDirection.Backward,
    dontThrowOnSelectionInteractors: payload.dontThrowOnSelectionInteractors ?? false,
  };

  const targets = selectTargets(state, services, payload.target);

  for (const target of lodash.reverse(targets)) {
    if (target.isSelection) {
      // ------------------
      // SELECTION DELETION
      // ------------------
      const chainsToDelete = getRangeForSelection(
        target.interactor,
        state.document2.document,
        services
      )?.getChainsCoveringRange(state.document2.document);

      if (!chainsToDelete) {
        continue;
      }

      // This is probably a very inefficient way to deal with text.. and everything
      const deletionHelper = new InteractorAnchorDeletionHelper(Object.values(state.interactors));
      const nav = new NodeNavigator(state.document2.document);
      for (const chain of lodash.reverse(chainsToDelete)) {
        nav.navigateTo(chain.path);
        deleteNode(nav, services, deletionHelper);
      }

      if (deletionHelper.hasAnchors()) {
        const cursorNav = target.isMainCursorFirst ? target.navigators[0].clone() : target.navigators[1].clone();
        const postDeleteAnchor = determineAnchorForAfterDeletion(cursorNav, FlowDirection.Forward, true);
        setMarkedInteractorAnchorsAfterNodeDeletion(services, postDeleteAnchor, deletionHelper);
      }

      // Clear selection
      target.interactor.selectionAnchor = undefined;
      services.interactors.notifyUpdated(target.interactor.id);
    } else {
      const { interactor, navigator } = target;

      const result = findNodeRelativeToCursorForDeletion(navigator as ReadonlyCursorNavigator, options);
      if (result?.nodeToDelete) {
        // ------------------------
        // INDIVIDUAL NODE DELETION
        // ------------------------
        const deletionHelper = new InteractorAnchorDeletionHelper(Object.values(state.interactors));
        deleteNode(result.nodeToDelete, services, deletionHelper);

        if (deletionHelper.hasAnchors()) {
          const postDeleteAnchor = determineAnchorForAfterDeletion(navigator, options.direction);
          setMarkedInteractorAnchorsAfterNodeDeletion(services, postDeleteAnchor, deletionHelper);
        }
      } else if (result?.justMoveTo) {
        // -------------------------------------------
        // JUST MOVE THE ANCHOR (DONT DELETE ANYTHING)
        // -------------------------------------------
        const newAnchor = Anchor.fromCursorNavigator(result.justMoveTo);
        if (newAnchor) {
          interactor.mainAnchor = newAnchor;
          // Should this clear selection?
          services.interactors.notifyUpdated(interactor.id);
        }
      } else if (result?.joinInstead) {
        // ----------------------
        // JOIN INSTEAD OF DELETE
        // ----------------------
        if (state.interactors[interactor.id] == undefined) {
          continue;
        }

        services.execute(
          state,
          joinBlocks({
            target: { interactorId: interactor.id },
            // Should this be its own option?
            mergeCompatibleInlineTextsIfPossible: true,
            direction: options.direction,
          })
        );
      }
    }
  }
});

/**
 * Note that the direction in the payload is just used for cursor placement after the deletion.
 */
export const deletePrimitive = createCoreOperation<{ path: Path | PathString; direction?: FlowDirection }>(
  "delete/primitive",
  (state, services, payload) => {
    const nodeToDelete = new NodeNavigator(state.document2.document);
    const originalCursorPosition = new CursorNavigator(state.document2.document, services.layout);

    if (!nodeToDelete.navigateTo(payload.path) || !originalCursorPosition.navigateTo(payload.path)) {
      return;
    }
    const anchorMarker = new InteractorAnchorDeletionHelper(Object.values(state.interactors));
    deleteNode(nodeToDelete, services, anchorMarker);
    if (anchorMarker.hasAnchors()) {
      const postDeleteAnchor = determineAnchorForAfterDeletion(
        originalCursorPosition,
        payload.direction || FlowDirection.Backward
      );
      setMarkedInteractorAnchorsAfterNodeDeletion(services, postDeleteAnchor, anchorMarker);
    }
  }
);

/**
 * This either returns:
 * 1. Nothing if there was no deletion
 * 2. A set of all nodes deleted EXCLUDING graphemes (so just object ids)
 * 3. In the case where JUST a grapheme is deleted, an object with the
 *    containing (ObjectNode) id and the grapheme index.
 */
function deleteNode(
  nodeNavigator: NodeNavigator,
  services: EditorOperationServices,
  deletionHelper: InteractorAnchorDeletionHelper
) {
  const node = nodeNavigator.tip.node;
  const parent = nodeNavigator.parent;
  const pathPart = nodeNavigator.tip.pathPart;
  const kidIndex = pathPart?.index;
  const kids = parent && NodeUtils.getChildren(parent.node);

  // This shouldn't be possible
  if (parent && (!kids || kidIndex === undefined)) {
    return undefined;
  }

  // Unregister all child nodes and the node itself
  if (!NodeUtils.isGrapheme(node)) {
    nodeNavigator.traverseDescendants(
      (n) => {
        services.tracking.unregister(n);
        deletionHelper.markAnchorsOnNode(NodeAssociatedData.getId(n) || "");
      },
      { skipGraphemes: true }
    );
    if (parent && kids) {
      services.tracking.unregister(node);
      deletionHelper.markAnchorsOnNode(NodeAssociatedData.getId(node) || "");
      castDraft(kids).splice(kidIndex, 1);
    } else {
      // This is the Document node case
      castDraft(node).children = [];
    }
  } else {
    // This is the grapheme case, note that at this point we always expect kids
    // to be defined
    if (parent && kids) {
      castDraft(kids).splice(kidIndex, 1);
      deletionHelper.markAnchorsRelativeToGrapheme(NodeAssociatedData.getId(parent.node) || "", kidIndex);
    }
  }
  return undefined;
}

function determineAnchorForAfterDeletion(
  originalPositionAndNode: ReadonlyCursorNavigator,
  direction: FlowDirection,
  forwardAgain?: boolean
): Anchor {
  const c = determineCursorPositionAfterDeletion(originalPositionAndNode, direction);
  if (forwardAgain) {
    c.navigateToNextCursorPosition();
  }
  const a = Anchor.fromCursorNavigator(c);
  if (!a) {
    throw new Error("Unexpectedly could not convert cursor position into anchor");
  }
  return a;
}

function determineCursorPositionAfterDeletion(
  originalPositionAndNode: ReadonlyCursorNavigator,
  direction: FlowDirection
): CursorNavigator {
  // The node that the `originalPosition` navigator is pointed to is now
  // deleted, along with (possibly) its parent and grandparent.
  const originalNode = originalPositionAndNode.tip.node;
  const originalParent = originalPositionAndNode.parent?.node;
  const originalCursor = originalPositionAndNode.cursor;
  const isBack = direction === undefined || direction === FlowDirection.Backward;

  const n = originalPositionAndNode.clone();
  if (n.navigateToUnchecked(originalCursor)) {
    if (NodeUtils.isGrapheme(originalNode)) {
      if (n.parent?.node === originalParent) {
        const currentIndex = n.tip.pathPart?.index;
        isBack ? n.navigateToPrecedingCursorPosition() : n.navigateToNextCursorPosition();

        // This fixes a bug where we navigate but the only thing that changed is
        // the CursorOrientation
        if (
          n.tip.pathPart &&
          n.tip.pathPart.index === currentIndex &&
          n.cursor.orientation === (isBack ? CursorOrientation.Before : CursorOrientation.After) &&
          (isBack ? n.toNodeNavigator().navigateToPrecedingSibling() : n.toNodeNavigator().navigateToNextSibling())
        ) {
          isBack ? n.navigateToPrecedingCursorPosition() : n.navigateToNextCursorPosition();
        }
        return n;
      }
      // OK we were able to navigate to the same cursor location but a different
      // node or parent node
      n.navigateToParentUnchecked();
    } else if (originalNode instanceof InlineEmoji) {
      if (n.parent?.node === originalPositionAndNode.parent?.node) {
        const currentIndex = n.tip.pathPart?.index;
        // JIC this node is an InlineUrlText or something do this
        n.navigateToFirstDescendantCursorPosition();
        // Then move the previous position... this actually works properly no
        // matter which direction we were moving... mostly. The check for here
        // is saying that if we are moving forward and landed On something
        // (which must be an empty inline text or emoji) don't move. This is a
        // little bit weird and specific so the logic here could definitely be
        // wrong.
        if (isBack || n.cursor.orientation !== CursorOrientation.On) {
          n.navigateToPrecedingCursorPosition();
        }

        // This fixes a bug where we navigate but the only thing that changed is
        // the CursorOrientation
        if (n.tip.pathPart && n.tip.pathPart.index === currentIndex) {
          if (n.cursor.orientation === CursorOrientation.On && originalCursor.orientation !== CursorOrientation.On) {
            isBack ? n.navigateToPrecedingCursorPosition() : n.navigateToNextCursorPosition();
          }
        }
        return n;
      }
      // OK we were able to navigate to the same cursor location but a different
      // node or parent node
      n.navigateToParentUnchecked();
    }
    if (n.navigateToPrecedingSiblingUnchecked()) {
      if (direction === FlowDirection.Forward && NodeUtils.isBlock(n.tip.node) && n.navigateToNextSiblingUnchecked()) {
        n.navigateToFirstDescendantCursorPosition();
      } else {
        n.navigateToLastDescendantCursorPosition();
      }
    } else {
      n.navigateToFirstDescendantCursorPosition();
    }
  } else {
    // Try one level higher as a fallback
    const p = originalCursor.path.withoutTip();
    if (n.navigateToUnchecked(new Cursor(p, CursorOrientation.On))) {
      n.navigateToLastDescendantCursorPosition();
    } else {
      // OK try one more level higher again
      const p2 = originalCursor.path.withoutTip().withoutTip();
      if (n.navigateToUnchecked(new Cursor(p2, CursorOrientation.On))) {
        // Not sure this is really right...
        n.navigateToLastDescendantCursorPosition();
      } else {
        // Not sure this is really right...
        if (!n.navigateToDocumentNodeUnchecked() || !n.navigateToFirstDescendantCursorPosition()) {
          throw new Error("Could not refresh navigator is not a valid cursor");
        }
      }
    }
  }
  return n;
}

/**
 * This function identifies the proper node to delete based on the passed in
 * navigator, which comes from an interactor's `mainCursor`.
 *
 * Depending on the passed in `DeleteAtOptions` instead of a deletion sometimes
 * movement can occur. In this case a CursorNavigator representing the new
 * position for the interactor is returned.
 *
 * Also undefined can be returned, indicating there is nothing to delete and the
 * interactor does not need to be moved.
 */
function findNodeRelativeToCursorForDeletion(
  navigator: ReadonlyCursorNavigator,
  options: DeleteAtOptions
):
  | { readonly justMoveTo?: CursorNavigator; readonly nodeToDelete?: NodeNavigator; readonly joinInstead?: boolean }
  | undefined {
  const isBack = options.direction === FlowDirection.Backward;
  const nodeToDelete = navigator.toNodeNavigator();
  const orientation = navigator.cursor.orientation;

  const currentNode = navigator.tip.node;
  if (NodeUtils.isGrapheme(currentNode)) {
    const parentAndTip = navigator.chain.getParentAndTipIfPossible();
    if (!parentAndTip) {
      return undefined;
    }
    const [parent, tip] = parentAndTip;

    if (!NodeUtils.isTextContainer(parent.node)) {
      return undefined;
    }

    let index = tip.pathPart?.index || 0;
    if (isBack) {
      if (orientation === CursorOrientation.Before) {
        index--;
      }
    } else {
      if (orientation === CursorOrientation.After) {
        index++;
        nodeToDelete.navigateToNextSibling();
      }
    }

    // Are we at the edge of the text containing Node (InlineText or InlineUrlLink?)
    if ((isBack && index === -1) || (!isBack && index === parent.node.children.length)) {
      const navPrime = navigator.clone();
      const parentHasPrecedingOrFollowingSibling =
        navPrime.navigateToParentUnchecked() &&
        (isBack ? navPrime.navigateToPrecedingSiblingUnchecked() : navPrime.navigateToNextSiblingUnchecked());

      // In the code here, we just handle the case where we are deleting
      // backwards (or forwards) from one InlineText to another inside the
      // same block (e.g. ParagraphBlock)
      if (
        options.allowAdjacentInlineTextDeletion &&
        parent.node instanceof InlineText &&
        parentHasPrecedingOrFollowingSibling &&
        navPrime.tip.node instanceof InlineText
      ) {
        isBack ? navPrime.navigateToLastDescendantCursorPosition() : navPrime.navigateToFirstDescendantCursorPosition();
        if (isBack && navPrime.cursor.orientation === CursorOrientation.Before) {
          navPrime.changeCursorOrientationUnchecked(CursorOrientation.After);
        } else if (!isBack && navPrime.cursor.orientation === CursorOrientation.After) {
          navPrime.changeCursorOrientationUnchecked(CursorOrientation.Before);
        }
        return findNodeRelativeToCursorForDeletion(navPrime, options);
      }

      // In this case we are handling deleting backwards or forwards onto an emoji
      if (
        options.allowAdjacentInlineEmojiDeletion &&
        parent.node instanceof InlineText &&
        parentHasPrecedingOrFollowingSibling &&
        navPrime.tip.node instanceof InlineEmoji
      ) {
        isBack ? navPrime.navigateToLastDescendantCursorPosition() : navPrime.navigateToFirstDescendantCursorPosition();
        if (isBack && navPrime.cursor.orientation === CursorOrientation.Before) {
          navPrime.changeCursorOrientationUnchecked(CursorOrientation.After);
        } else if (!isBack && navPrime.cursor.orientation === CursorOrientation.After) {
          navPrime.changeCursorOrientationUnchecked(CursorOrientation.Before);
        }
        return findNodeRelativeToCursorForDeletion(navPrime, options);
      }

      // Joining logic should probably be added here in the future
      if (options.allowJoiningBlocksInBoundaryCases) {
        return { joinInstead: true };
      }

      // Fall through to movement logic (which sometimes but not always is
      // applied) below...
    } else {
      if (parent.node.text.length === 1 && parent.node instanceof InlineText) {
        // In this case we are about to remove the last character in an
        // inline text In this case, we prefer to delete the inline text.
        const navPrime = navigator.toNodeNavigator();
        navPrime.navigateToParent();
        return { nodeToDelete: navPrime };
      } else {
        // In this case, the nodeToDelete is already on the right node
        return { nodeToDelete };
      }
    }
  } else if (orientation === CursorOrientation.On) {
    return { nodeToDelete };
  } else if (options.allowAdjacentInlineEmojiDeletion) {
    // Orientation has to be before or after here in this block
    if ((orientation === CursorOrientation.After && isBack) || (orientation === CursorOrientation.Before && !isBack)) {
      if (nodeToDelete.tip.node instanceof InlineEmoji) {
        return { nodeToDelete };
      }
    } else {
      // This case is either before and going back or after and going forward
      const navPrime = nodeToDelete.clone();
      if (
        (isBack ? navPrime.navigateToPrecedingSibling() : navPrime.navigateToNextSibling()) &&
        navPrime.tip.node instanceof InlineEmoji
      ) {
        return { nodeToDelete: navPrime };
      }
    }
  }

  // Non-deletion potential movement logic
  if (options.allowMovementInBoundaryCases) {
    const navPrime = navigator.clone();
    isBack ? navPrime.navigateToPrecedingCursorPosition() : navPrime.navigateToNextCursorPosition();
    return { justMoveTo: navPrime };
  }
  return undefined;
}

function setMarkedInteractorAnchorsAfterNodeDeletion(
  services: EditorOperationServices,
  postDeleteAnchor: Anchor,
  deletionHelper: InteractorAnchorDeletionHelper
) {
  for (const { interactor, anchorType, relativeGraphemeDeletionCount } of deletionHelper.getAnchors()) {
    if (anchorType === InteractorAnchorType.Main) {
      if (relativeGraphemeDeletionCount === undefined || interactor.mainAnchor.graphemeIndex === undefined) {
        castDraft(interactor).mainAnchor = postDeleteAnchor;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        castDraft(interactor).mainAnchor.graphemeIndex! -= relativeGraphemeDeletionCount;
      }
    } else {
      if (relativeGraphemeDeletionCount === undefined || interactor.selectionAnchor?.graphemeIndex === undefined) {
        castDraft(interactor).selectionAnchor = postDeleteAnchor;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        castDraft(interactor).selectionAnchor!.graphemeIndex! -= relativeGraphemeDeletionCount;
      }
    }
    services.interactors.notifyUpdated(interactor.id);
  }
}
