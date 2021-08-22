import { FriendlyIdGenerator } from "doctarion-utils";
import { Draft, castDraft } from "immer";

import { Path, PathPart } from "../../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation } from "../../cursor";
import { NodeLayoutReporter } from "../../layout-reporting";
import { NodeUtils, ObjectNode } from "../../models";
import { Anchor, AnchorOrientation, NodeAssociatedData, NodeId, WorkingDocument } from "../../working-document";
import { EditorEvents } from "../events";
import { Interactor, InteractorAnchorType, InteractorId, InteractorStatus } from "../interactor";
import { EditorOperationError, EditorOperationErrorCode } from "../operationError";
import { EditorState } from "../state";
import { InteractorInputPosition, convertInteractorInputPositionToCursorNavigator } from "../utils";

import { EditorOperationServices } from "./services";

/**
 * This manages all interactors.
 *
 * This is intended to _only_ be used by `EditorOperation` functions.
 */
export class EditorInteractorService {
  private editorState: Draft<EditorState> | null;
  private updatedInteractors: Set<InteractorId> | null;

  public constructor(
    private readonly editorEvents: EditorEvents,
    private idGenerator: FriendlyIdGenerator,
    private layout?: NodeLayoutReporter
  ) {
    this.editorState = null;
    this.updatedInteractors = null;
    this.editorEvents.operationWillRun.addListener(this.handleOperationWillRun);
    this.editorEvents.operationHasCompleted.addListener(this.handleOperationHasCompleted);
    this.editorEvents.operationHasRun.addListener(this.handleOperationHasRun);
  }

  public add(options: {
    to: InteractorInputPosition;
    selectTo?: InteractorInputPosition;
    status: InteractorStatus;
    focused?: boolean;
    name?: string;
    lineMovementHorizontalVisualAnchor?: number;
  }): Interactor | undefined {
    const { name, status, ...otherOptions } = options;
    const id = this.idGenerator.generateId("INTERACTOR");
    // We are giving this an undefined mainAnchor, which is cheating, but is
    // convenient here. We set it in updateInteractor so its ok.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newInteractor = new Interactor(id, undefined as any, status, undefined, undefined, name);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.editorState!.interactors[id] = newInteractor;
    this.updateInteractor(id, otherOptions);

    const dedupeIds = this.dedupe();
    if (dedupeIds && dedupeIds.includes(newInteractor.id)) {
      this.delete(id);
      // TODO throw?
      return undefined;
    }
    return newInteractor;
  }

  public anchorInfoFromCursorNavigator(
    cursorNavigator: CursorNavigator
  ):
    | {
        readonly nodeId: NodeId;
        readonly orientation: AnchorOrientation;
        readonly graphemeIndex?: number;
      }
    | undefined {
    const node = cursorNavigator.tip.node;
    if (NodeUtils.isGrapheme(node)) {
      const parent = cursorNavigator.parent?.node;
      if (!parent) {
        return undefined;
      }
      const parentId = NodeAssociatedData.getId(parent);
      if (!parentId) {
        return undefined;
      }
      return {
        nodeId: parentId,
        orientation: (cursorNavigator.cursor.orientation as unknown) as AnchorOrientation,
        graphemeIndex: cursorNavigator.tip.pathPart.index,
      };
    }
    const nodeId = NodeAssociatedData.getId(node);
    if (!nodeId) {
      return undefined;
    }
    return {
      nodeId,
      orientation: (cursorNavigator.cursor.orientation as unknown) as AnchorOrientation,
      graphemeIndex: undefined,
    };
  }

  public anchorToCursor(anchor: Anchor): Cursor | undefined {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const workingDocument = this.editorState!.document2;
    const path = workingDocument.lookupPathTo(anchor.nodeId);
    if (!path) {
      return undefined;
    }
    if (anchor.graphemeIndex !== undefined) {
      return new Cursor(
        new Path([...path.parts, new PathPart(anchor.graphemeIndex)]),
        (anchor.orientation as unknown) as CursorOrientation
      );
    }
    return new Cursor(path, (anchor.orientation as unknown) as CursorOrientation);
  }

  public delete(id: InteractorId): void {
    if (!this.editorState) {
      return;
    }
    const interactor = this.editorState.interactors[id];
    if (!interactor) {
      return;
    }
    this.editorState.document2.deleteAnchor(interactor.mainAnchor);
    interactor.selectionAnchor && this.editorState.document2.deleteAnchor(interactor.selectionAnchor);
    delete this.editorState.interactors[id];
    if (this.editorState.focusedInteractorId === id) {
      this.editorState.focusedInteractorId = undefined;
    }
  }

  public getAnchor(id: InteractorId | Interactor, anchorType: InteractorAnchorType): Anchor | undefined {
    const interactor = typeof id === "string" ? this.editorState?.interactors[id] : id;
    if (!interactor || !this.editorState) {
      return undefined;
    }
    const anchorId = interactor.getAnchor(anchorType);
    return anchorId ? this.editorState.document2.getAnchor(anchorId) : undefined;
  }

  public jiggleInteractors(
    services: EditorOperationServices,
    workingDocument: Draft<WorkingDocument>,
    all?: boolean
  ): void {
    if (!this.editorState) {
      return;
    }

    const navHelper = new CursorNavigator(this.editorState.document2.document, services.layout);

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
      const info = this.anchorInfoFromCursorNavigator(navHelper);
      if (!info) {
        return;
      }
      castDraft(currentAnchor).nodeId = info.nodeId;
      castDraft(currentAnchor).orientation = info.orientation;
      castDraft(currentAnchor).graphemeIndex = info.graphemeIndex;
    };

    if (all) {
      for (const interactor of Object.values(this.editorState.interactors)) {
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
        const interactor = this.editorState.interactors[id];
        if (!interactor) {
          continue;
        }
        updateAnchor(interactor, InteractorAnchorType.Main);
        interactor.selectionAnchor && updateAnchor(interactor, InteractorAnchorType.SelectionAnchor);
      }
    }
  }

  public notifyUpdated(id: InteractorId | InteractorId[]): void {
    if (!this.editorState) {
      return;
    }

    if (!this.updatedInteractors) {
      this.updatedInteractors = new Set();
    }

    if (typeof id === "string") {
      this.updatedInteractors.add(id);
    } else {
      for (const actualId of id) {
        this.updatedInteractors.add(actualId);
      }
    }
  }

  public updateAnchor(
    id: InteractorId | Interactor,
    anchorType: InteractorAnchorType,
    updates: {
      readonly nodeId?: NodeId;
      readonly orientation?: AnchorOrientation;
      readonly graphemeIndex?: number | undefined;
    }
  ): void {
    const interactor = typeof id === "string" ? this.editorState?.interactors[id] : id;
    if (!interactor || !this.editorState) {
      return undefined;
    }
    const anchorId = interactor.getAnchor(anchorType);
    const anchor = this.getAnchor(interactor, anchorType);
    anchorId &&
      anchor &&
      this.editorState.document2.updateAnchor(
        anchorId,
        updates.nodeId ?? anchor.nodeId,
        updates.orientation ?? anchor.orientation,
        "graphemeIndex" in updates ? updates.graphemeIndex : anchor.graphemeIndex
      );
    this.notifyUpdated(interactor.id);
  }

  public updateInteractor(
    id: InteractorId,
    options: {
      to?: InteractorInputPosition;
      selectTo?: InteractorInputPosition | "main";
      status?: InteractorStatus;
      focused?: boolean;
      name?: string;
      lineMovementHorizontalVisualAnchor?: number;
    }
  ): void {
    if (!this.editorState) {
      throw new Error("no editor state");
    }

    const interactor = this.editorState?.interactors[id];
    if (!interactor) {
      // TODO new exception type
      throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "no interactor found with given id");
    }

    if ("lineMovementHorizontalVisualAnchor" in options) {
      interactor.lineMovementHorizontalVisualAnchor = options.lineMovementHorizontalVisualAnchor;
    }

    if ("selectTo" in options) {
      if (options.selectTo) {
        let anchorInfo;
        if (options.selectTo === "main") {
          anchorInfo = this.editorState.document2.getAnchor(interactor.mainAnchor);
          if (!anchorInfo) {
            throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument);
          }
        } else {
          const nav = convertInteractorInputPositionToCursorNavigator(this.editorState, this.layout, options.selectTo);
          if (!nav) {
            throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument);
          }
          anchorInfo = this.anchorInfoFromCursorNavigator(nav);
          if (!anchorInfo) {
            throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument);
          }
        }
        if (interactor.selectionAnchor) {
          const anchor = this.editorState.document2.getAnchor(interactor.selectionAnchor);
          if (!anchor) {
            throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState);
          }
          castDraft(anchor).nodeId = anchorInfo.nodeId;
          castDraft(anchor).orientation = anchorInfo.orientation;
          castDraft(anchor).graphemeIndex = anchorInfo.graphemeIndex;
        } else {
          const anchor = this.editorState.document2.createAnchor(
            anchorInfo.nodeId,
            anchorInfo.orientation,
            anchorInfo.graphemeIndex,
            interactor.name ? interactor.name + "-SELECTION" : undefined
          );
          if (!anchor) {
            throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument);
          }
          interactor.selectionAnchor = anchor.id;
        }
      } else {
        if (interactor.selectionAnchor) {
          this.editorState.document2.deleteAnchor(interactor.selectionAnchor);
        }
        interactor.selectionAnchor = undefined;
      }
    }

    if (options.to) {
      const nav = convertInteractorInputPositionToCursorNavigator(this.editorState, this.layout, options.to);
      if (!nav) {
        throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument);
      }
      const anchorInfo = this.anchorInfoFromCursorNavigator(nav);
      if (!anchorInfo) {
        throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument);
      }
      if (interactor.mainAnchor) {
        const mainAnchor = this.editorState.document2.getAnchor(interactor.mainAnchor);
        if (!mainAnchor) {
          throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState);
        }
        castDraft(mainAnchor).nodeId = anchorInfo.nodeId;
        castDraft(mainAnchor).orientation = anchorInfo.orientation;
        castDraft(mainAnchor).graphemeIndex = anchorInfo.graphemeIndex;
      } else {
        const mainAnchor = this.editorState.document2.createAnchor(
          anchorInfo.nodeId,
          anchorInfo.orientation,
          anchorInfo.graphemeIndex,
          interactor.name ? interactor.name + "-MAIN" : undefined
        );
        if (!mainAnchor) {
          throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument);
        }
        interactor.mainAnchor = mainAnchor.id;
      }
    }

    if ("name" in options) {
      interactor.name = options.name;
    }

    if (options.status) {
      interactor.status = options.status;
    }

    this.notifyUpdated(interactor.id);

    if (options.focused !== undefined) {
      if (options.focused) {
        this.editorState.focusedInteractorId = id;
      } else {
        if (this.editorState.focusedInteractorId === id) {
          this.editorState.focusedInteractorId = undefined;
        }
      }
    }
  }

  /**
   * There definitely could be more situations in which we want to dedupe
   * interactors, but for right now we only dedupe interactors that aren't a
   * selection AND have the same status AND their mainCursor is equal.
   *
   * This must be called after the interactorOrdering has been sorted.
   */
  private dedupe(): InteractorId[] | undefined {
    if (!this.editorState) {
      return;
    }

    const interactors = Object.values(this.editorState.interactors);
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
      const mainAnchor = this.editorState.document2.getAnchor(i.mainAnchor);
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
        const i = this.editorState.interactors[id];
        this.editorState.document2.deleteAnchor(i.mainAnchor);
        i.selectionAnchor && this.editorState.document2.deleteAnchor(i.selectionAnchor);
        delete this.editorState.interactors[id];
        if (this.editorState.focusedInteractorId === id) {
          this.editorState.focusedInteractorId = undefined;
        }
      }
    }
    return dupeIds;
  }

  private handleOperationHasCompleted = (newState: EditorState) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.editorState = newState as any; // null;
    this.updatedInteractors = null;
  };

  private handleOperationHasRun = () => {
    if (this.updatedInteractors) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      // for (const id of this.updatedInteractors) {
      //   this.updateInteractorOrderingFor(id);
      // }
      // Then take care of status and cursor position changes by just doing the
      // simplest thing possible and resorting the ordered iterators.
      // this.editorState?.interactorOrdering.sort(this.comparator);
      this.dedupe();
    }
  };

  private handleOperationWillRun = (newState: Draft<EditorState>) => {
    this.editorState = newState;
  };
}
