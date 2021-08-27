import { Draft } from "immer";

import { NodeNavigator, Path, PathPart, ReadonlyNodeNavigator } from "../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation, NodeLayoutReporter } from "../cursor";
import { InlineEmoji, NodeUtils } from "../models";
import {
  Anchor,
  AnchorId,
  AnchorOrientation,
  AnchorPosition,
  AnchorsOrphanedEventPayload,
  FlowDirection,
  Interactor,
  InteractorAnchorType,
  InteractorId,
  NodeAssociatedData,
  NodesJoinedEventPayload,
} from "../working-document";

import { EditorEvents } from "./events";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { EditorState } from "./state";
import { InteractorInputPosition, getNearestAncestorBlock } from "./utils";

export class EditorInteractorService {
  private anchorsNeedJiggle?: undefined | "updatedInteractors" | "all";
  // TODO should we also be tracking updated anchors?
  private updatedInteractors: Set<InteractorId> | null;

  public constructor(
    private readonly editorEvents: EditorEvents,
    private editorState: Draft<EditorState>,
    private layout?: NodeLayoutReporter
  ) {
    this.updatedInteractors = null;
    this.anchorsNeedJiggle = undefined;
    this.editorEvents.operationWillRun.addListener(this.handleOperationWillRun);
    this.editorEvents.operationHasCompleted.addListener(this.handleOperationHasCompleted);
    this.editorEvents.operationHasRun.addListener(this.handleOperationHasRun);
    this.editorState.events.anchorsOrphaned.addListener(this.handleAnchorsOrphaned);
    this.editorState.events.interactorUpdated.addListener(this.handleInteractorUpdated);
    this.editorState.events.nodesJoined.addListener(this.handleNodesJoined);
  }

  public anchorToCursor(id: AnchorId | Anchor): Cursor {
    const anchor = typeof id === "string" ? this.editorState.getAnchor(id) : id;
    if (!anchor) {
      throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "Could not find anchor");
    }
    const path = this.editorState.lookupPathTo(anchor.nodeId);
    if (!path) {
      throw new EditorOperationError(
        EditorOperationErrorCode.InvalidArgument,
        "Path to node specified by anchor not found."
      );
    }
    if (anchor.graphemeIndex !== undefined) {
      return new Cursor(
        new Path([...path.parts, new PathPart(anchor.graphemeIndex)]),
        (anchor.orientation as unknown) as CursorOrientation
      );
    }
    return new Cursor(path, (anchor.orientation as unknown) as CursorOrientation);
  }

  public convertInteractorInputPositionToAnchorPosition(position: InteractorInputPosition): AnchorPosition {
    const nav = new CursorNavigator(this.editorState.document, this.layout);
    const cursor =
      position instanceof Cursor
        ? position
        : new Cursor(position.path instanceof Path ? position.path : Path.parse(position.path), position.orientation);

    if (!cursor || !nav.navigateTo(cursor)) {
      throw new EditorOperationError(EditorOperationErrorCode.InvalidCursorPosition, "Invalid position");
    }

    return this.cursorNavigatorToAnchorPosition(nav);
  }

  public cursorNavigatorToAnchorPosition(cursorNavigator: CursorNavigator): AnchorPosition {
    const node = cursorNavigator.tip.node;
    if (NodeUtils.isGrapheme(node)) {
      const parent = cursorNavigator.parent?.node;
      if (!parent) {
        throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState, "Grapheme lacks parent");
      }
      const parentId = NodeAssociatedData.getId(parent);
      if (!parentId) {
        throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState, "Node's parent lacks id");
      }
      return {
        nodeId: parentId,
        orientation: (cursorNavigator.cursor.orientation as unknown) as AnchorOrientation,
        graphemeIndex: cursorNavigator.tip.pathPart.index,
      };
    }
    const nodeId = NodeAssociatedData.getId(node);
    if (!nodeId) {
      throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState, "Node lacks id");
    }
    return {
      nodeId,
      orientation: (cursorNavigator.cursor.orientation as unknown) as AnchorOrientation,
      graphemeIndex: undefined,
    };
  }

  /**
   * There definitely could be more situations in which we want to dedupe
   * interactors, but for right now we only dedupe interactors that aren't a
   * selection AND have the same status AND their mainCursor is equal.
   *
   * This must be called after the interactorOrdering has been sorted.
   */
  public dedupeInteractors(): InteractorId[] | undefined {
    if (!this.editorState) {
      return;
    }

    const interactors = this.editorState.getAllInteractors();
    if (interactors.length < 2) {
      return;
    }

    // Try to remove any interactors that are exact matches for another
    // interactor, but only consider NON-selections. Its unclear at this
    // point what the best behavior for selections would be.
    let dupeIds: InteractorId[] | undefined;
    const seenKeys = new Set<string>();
    for (const i of interactors) {
      if (i.isSelection) {
        continue;
      }
      const mainAnchor = this.editorState.getAnchor(i.mainAnchor);
      if (!mainAnchor) {
        continue;
      }
      const key = `${mainAnchor.nodeId}${mainAnchor.orientation}${mainAnchor.graphemeIndex || ""}${i.status}`;
      if (seenKeys.has(key)) {
        if (!dupeIds) {
          dupeIds = [];
        }
        dupeIds.push(i.id);
      }
      seenKeys.add(key);
    }

    if (dupeIds) {
      for (const id of dupeIds) {
        this.editorState.deleteInteractor(id);
        if (this.editorState.focusedInteractorId === id) {
          this.editorState.focusedInteractorId = undefined;
        }
      }
    }
    return dupeIds;
  }

  private determineCursorPositionAfterDeletion(
    originalPositionAndNode: ReadonlyNodeNavigator,
    direction: FlowDirection
  ): CursorNavigator {
    // The node that the `originalPosition` navigator is pointed to is now
    // deleted, along with (possibly) its parent and grandparent.
    const originalNode = originalPositionAndNode.tip.node;
    const originalParent = originalPositionAndNode.parent?.node;
    const isBack = direction === undefined || direction === FlowDirection.Backward;

    const n = new CursorNavigator(this.editorState.document, this.layout);
    if (n.navigateFreeformTo(originalPositionAndNode.path, CursorOrientation.On)) {
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
        n.navigateFreeformToParent();
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
            // if (n.cursor.orientation === CursorOrientation.On && originalCursor.orientation !== CursorOrientation.On) {
            //   isBack ? n.navigateToPrecedingCursorPosition() : n.navigateToNextCursorPosition();
            // }
            // if (n.cursor.orientation === CursorOrientation.On) {
            //   isBack ? n.navigateToPrecedingCursorPosition() : n.navigateToNextCursorPosition();
            // }
          }
          return n;
        }
        // OK we were able to navigate to the same cursor location but a different
        // node or parent node
        n.navigateFreeformToParent();
      }
      if (n.navigateFreeformToPrecedingSibling()) {
        if (direction === FlowDirection.Forward && NodeUtils.isBlock(n.tip.node) && n.navigateFreeformToNextSibling()) {
          n.navigateToFirstDescendantCursorPosition();
        } else {
          n.navigateToLastDescendantCursorPosition();
        }
      } else {
        n.navigateToFirstDescendantCursorPosition();
      }
    } else {
      // Try one level higher as a fallback
      const p = originalPositionAndNode.path.withoutTip();
      if (n.navigateFreeformTo(new Cursor(p, CursorOrientation.On))) {
        n.navigateToLastDescendantCursorPosition();
      } else {
        // OK try one more level higher again
        const p2 = originalPositionAndNode.path.withoutTip().withoutTip();
        if (n.navigateFreeformTo(new Cursor(p2, CursorOrientation.On))) {
          // Not sure this is really right...
          n.navigateToLastDescendantCursorPosition();
        } else {
          // Not sure this is really right...
          if (!n.navigateFreeformToDocumentNode() || !n.navigateToFirstDescendantCursorPosition()) {
            throw new Error("Could not refresh navigator is not a valid cursor");
          }
        }
      }
    }
    return n;
  }

  private handleAnchorsOrphaned = ({
    anchors,
    deletionTarget,
    deletionAdditionalContext,
  }: AnchorsOrphanedEventPayload) => {
    if (anchors.length === 0) {
      return;
    }

    const postDeleteCursor = this.determineCursorPositionAfterDeletion(
      deletionTarget instanceof NodeNavigator
        ? deletionTarget
        : // This is always the "from" navigator because the node on the "to"
          // navigator can be very far past the end of the (new) document
          (deletionTarget as [ReadonlyNodeNavigator, ReadonlyNodeNavigator])[0],
      deletionAdditionalContext?.flow || FlowDirection.Backward
    );
    // Minor fixup for selections... ideally wouldn't have to do this
    if (Array.isArray(deletionTarget)) {
      postDeleteCursor.navigateToNextCursorPosition();
    }

    const anchorPosition = this.cursorNavigatorToAnchorPosition(postDeleteCursor);

    for (const anchor of anchors) {
      this.editorState.updateAnchor(
        anchor.id,
        anchorPosition.nodeId,
        anchorPosition.orientation,
        anchorPosition.graphemeIndex
      );
    }
  };

  private handleInteractorUpdated = (interactor: Interactor) => {
    if (!this.editorState) {
      return;
    }

    if (!this.updatedInteractors) {
      this.updatedInteractors = new Set();
    }

    this.updatedInteractors.add(interactor.id);
  };

  private handleNodesJoined = ({ destination }: NodesJoinedEventPayload) => {
    if (NodeUtils.isBlock(destination.tip.node)) {
      this.anchorsNeedJiggle = "all";
    } else {
      if (this.anchorsNeedJiggle !== "all") {
        this.anchorsNeedJiggle = "updatedInteractors";
      }
    }
  };

  private handleOperationHasCompleted = (newState: EditorState) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    this.editorState = newState as any; // null;
    this.updatedInteractors = null;
    this.anchorsNeedJiggle = undefined;
  };

  private handleOperationHasRun = () => {
    if (this.updatedInteractors || this.anchorsNeedJiggle) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      // Then take care of status and cursor position changes by just doing the
      // simplest thing possible and resorting the ordered iterators.
      // this.editorState?.interactorOrdering.sort(this.comparator);
      this.dedupeInteractors();

      if (this.updatedInteractors) {
        for (const id of this.updatedInteractors) {
          if (this.editorState?.focusedInteractorId === id && this.editorState?.getInteractor(id) === undefined) {
            this.editorState.focusedInteractorId = undefined;
          }
        }
      }

      if (this.anchorsNeedJiggle) {
        this.jiggleAnchors(this.anchorsNeedJiggle === "all");
        this.anchorsNeedJiggle = undefined;
      }
    }
  };

  private handleOperationWillRun = (newState: Draft<EditorState>) => {
    this.editorState = newState;
  };

  private jiggleAnchors(allAnchors?: boolean): void {
    if (!this.editorState) {
      return;
    }

    const navHelper = new CursorNavigator(this.editorState.document, this.layout);

    const updateAnchor = (anchor: Draft<Anchor>) => {
      const currentCursor = this.anchorToCursor(anchor);
      if (currentCursor && !navHelper.navigateTo(currentCursor)) {
        return;
      }

      const originalBlock = getNearestAncestorBlock(navHelper);
      if (navHelper.navigateToNextCursorPosition()) {
        // console.log("jigggline#", navHelper.cursor.toString());
        const newBlock = getNearestAncestorBlock(navHelper);
        if (originalBlock !== newBlock) {
          navHelper.navigateToPrecedingCursorPosition();
          // console.log("bail jigggline#", navHelper.cursor.toString());
        } else {
          navHelper.navigateToPrecedingCursorPosition();
          // console.log("jigggline##", navHelper.cursor.toString());
          const newerBlock = getNearestAncestorBlock(navHelper);
          if (newBlock !== newerBlock) {
            navHelper.navigateToNextCursorPosition();
            // console.log("bail jigggline##", navHelper.cursor.toString());
          }
        }
      }

      const info = this.cursorNavigatorToAnchorPosition(navHelper);
      if (!info) {
        return;
      }

      // Note that this may very well fire a new interactorUpdated event... this
      // seems ok for now but we may want to have a way to ignore this.
      this.editorState.updateAnchor(anchor.id, info.nodeId, info.orientation, info.graphemeIndex);
    };

    if (allAnchors) {
      for (const a of this.editorState.getAllAnchors()) {
        // console.log("updating anchor in jiggle: ", this.anchorToCursor(a).toString());
        updateAnchor(a);
      }
    } else {
      if (!this.updatedInteractors) {
        return;
      }
      for (const id of this.updatedInteractors) {
        const interactor = this.editorState.getInteractor(id);
        if (!interactor) {
          continue;
        }
        let anchor = this.editorState.getInteractorAnchor(id, InteractorAnchorType.Main);
        if (anchor) {
          updateAnchor(anchor);
        }
        anchor = interactor.selectionAnchor
          ? this.editorState.getInteractorAnchor(id, InteractorAnchorType.SelectionAnchor)
          : undefined;
        if (anchor) {
          updateAnchor(anchor);
        }
      }
    }
  }
}
