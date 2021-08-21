import { Draft, castDraft } from "immer";

import { CursorNavigator } from "../../cursor";
import { Anchor } from "../anchor";
import { EditorEvents } from "../events";
import { Interactor, InteractorAnchorType, InteractorId } from "../interactor";
import { EditorState } from "../state";

import { EditorServices } from "./services";

/**
 * This manages all interactors.
 *
 * This is intended to _only_ be used by `EditorOperation` functions.
 */
export class EditorInteractorService {
  private editorState: Draft<EditorState> | null;
  private updatedInteractors: Set<InteractorId> | null;

  public constructor(private readonly editorEvents: EditorEvents) {
    this.editorState = null;
    this.updatedInteractors = null;
    this.editorEvents.operationWillRun.addListener(this.handleOperationWillRun);
    this.editorEvents.operationHasCompleted.addListener(this.handleOperationHasCompleted);
    this.editorEvents.operationHasRun.addListener(this.handleOperationHasRun);
  }

  public add(newInteractor: Interactor): boolean {
    if (!this.editorState) {
      return false;
    }
    this.editorState.interactors[newInteractor.id] = castDraft(newInteractor);
    const dedupeIds = this.dedupe();
    if (dedupeIds) {
      return !dedupeIds.includes(newInteractor.id);
    }
    return true;
  }

  public delete(id: InteractorId): void {
    if (!this.editorState) {
      return;
    }
    const interactor = this.editorState.interactors[id];
    if (!interactor) {
      return;
    }

    delete this.editorState.interactors[id];
  }

  public jiggleInteractors(services: EditorServices, all?: boolean): void {
    if (!this.editorState) {
      return;
    }

    const navHelper = new CursorNavigator(this.editorState.document2.document, services.layout);

    function updateAnchor(interactor: Draft<Interactor>, anchorType: InteractorAnchorType) {
      const currentAnchor = interactor.getAnchor(anchorType);
      if (!currentAnchor) {
        return;
      }
      const currentCursor = currentAnchor.toCursor(services);
      if (currentCursor && !navHelper.navigateTo(currentCursor)) {
        return;
      }
      if (navHelper.navigateToNextCursorPosition()) {
        navHelper.navigateToPrecedingCursorPosition();
      }
      const newAnchor = Anchor.fromCursorNavigator(navHelper);
      if (newAnchor) {
        if (anchorType === InteractorAnchorType.Main) {
          interactor.mainAnchor = newAnchor;
        } else {
          interactor.selectionAnchor = newAnchor;
        }
      }
    }

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
      const key = `${i.mainAnchor.nodeId}${i.mainAnchor.orientation}${i.mainAnchor.graphemeIndex || ""}${i.status}`;
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
        delete this.editorState.interactors[id];
        if (this.editorState.focusedInteractorId === id) {
          this.editorState.focusedInteractorId = undefined;
        }
      }
    }
    return dupeIds;
  }

  private handleOperationHasCompleted = () => {
    this.editorState = null;
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
