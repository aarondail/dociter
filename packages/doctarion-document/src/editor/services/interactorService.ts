import { Draft, castDraft } from "immer";

import { Path, PathPart } from "../../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation, NodeLayoutReporter } from "../../cursor";
import { NodeUtils } from "../../models";
import {
  Anchor,
  AnchorId,
  AnchorOrientation,
  AnchorPosition,
  Interactor,
  InteractorAnchorType,
  InteractorId,
  NodeAssociatedData,
  WorkingDocument,
} from "../../working-document";
import { EditorEvents } from "../events";
import { EditorOperationError, EditorOperationErrorCode } from "../operationError";
import { EditorState } from "../state";
import { InteractorInputPosition } from "../utils";

import { EditorOperationServices } from "./services";

export class EditorInteractorService {
  private updatedInteractors: Set<InteractorId> | null;

  public constructor(
    private readonly editorEvents: EditorEvents,
    private editorState: Draft<EditorState>,
    private layout?: NodeLayoutReporter
  ) {
    this.updatedInteractors = null;
    this.editorEvents.operationWillRun.addListener(this.handleOperationWillRun);
    this.editorEvents.operationHasCompleted.addListener(this.handleOperationHasCompleted);
    this.editorEvents.operationHasRun.addListener(this.handleOperationHasRun);
    this.editorState.events.interactorUpdated.addListener(this.handleInteractorUpdated);
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
  public dedupe(): InteractorId[] | undefined {
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

  public jiggleInteractors(
    services: EditorOperationServices,
    workingDocument: Draft<WorkingDocument>,
    all?: boolean
  ): void {
    if (!this.editorState) {
      return;
    }

    const navHelper = new CursorNavigator(this.editorState.document, services.layout);

    const updateAnchor = (interactor: Draft<Interactor>, anchorType: InteractorAnchorType) => {
      const currentAnchor = workingDocument.getAnchor(interactor.getAnchor(anchorType) || "");
      if (!currentAnchor) {
        return;
      }
      const currentCursor = this.anchorToCursor(currentAnchor);
      if (currentCursor && !navHelper.navigateTo(currentCursor)) {
        return;
      }
      if (navHelper.navigateToNextCursorPosition()) {
        navHelper.navigateToPrecedingCursorPosition();
      }
      const info = this.cursorNavigatorToAnchorPosition(navHelper);
      if (!info) {
        return;
      }
      castDraft(currentAnchor).nodeId = info.nodeId;
      castDraft(currentAnchor).orientation = info.orientation;
      castDraft(currentAnchor).graphemeIndex = info.graphemeIndex;
    };

    if (all) {
      for (const interactor of this.editorState.getAllInteractors()) {
        if (!interactor) {
          continue;
        }
        updateAnchor(interactor, InteractorAnchorType.Main);
        interactor.selectionAnchor && updateAnchor(interactor, InteractorAnchorType.SelectionAnchor);
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
        updateAnchor(interactor, InteractorAnchorType.Main);
        interactor.selectionAnchor && updateAnchor(interactor, InteractorAnchorType.SelectionAnchor);
      }
    }
  }

  private handleInteractorUpdated = (id: InteractorId) => {
    if (!this.editorState) {
      return;
    }

    if (!this.updatedInteractors) {
      this.updatedInteractors = new Set();
    }

    if (typeof id === "string") {
      this.updatedInteractors.add(id);
      // } else {
      //   for (const actualId of id) {
      //     this.updatedInteractors.add(actualId);
      //   }
    }
  };

  private handleOperationHasCompleted = (newState: EditorState) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    this.editorState = newState as any; // null;
    this.updatedInteractors = null;
  };

  private handleOperationHasRun = () => {
    if (this.updatedInteractors) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      // Then take care of status and cursor position changes by just doing the
      // simplest thing possible and resorting the ordered iterators.
      // this.editorState?.interactorOrdering.sort(this.comparator);
      this.dedupe();

      for (const id of this.updatedInteractors) {
        if (this.editorState?.focusedInteractorId === id && this.editorState?.getInteractor(id) === undefined) {
          this.editorState.focusedInteractorId = undefined;
        }
      }
    }
  };

  private handleOperationWillRun = (newState: Draft<EditorState>) => {
    this.editorState = newState;
  };
}
