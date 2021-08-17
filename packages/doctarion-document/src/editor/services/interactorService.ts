/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Draft, castDraft } from "immer";
import { CursorNavigator } from "../../cursor";
import { NodeLayoutReporter } from "../../layout-reporting";
import { Anchor } from "../anchor";

import { EditorEvents } from "../events";
import { Interactor, InteractorAnchorType, InteractorId } from "../interactor";
import { EditorState } from "../state";
import { EditorNodeLookupService } from "./nodeLookupService";
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

    // const mainEntry = { id, cursorType: InteractorAnchorType.Main };
    // const mainEntryIndex = binarySearch(this.editorState.interactorOrdering, mainEntry, this.comparator);
    // if (mainEntryIndex >= 0) {
    //   this.editorState.interactorOrdering.splice(mainEntryIndex, 1);
    // }

    // if (interactor.selectionAnchor) {
    //   const newSelectionEntry = { id, cursorType: InteractorAnchorType.SelectionAnchor };
    //   const selectionEntryIndex = binarySearch(this.editorState.interactorOrdering, newSelectionEntry, this.comparator);
    //   if (selectionEntryIndex >= 0) {
    //     this.editorState.interactorOrdering.splice(selectionEntryIndex, 1);
    //   }
    // }

    delete this.editorState.interactors[id];
  }

  // public interactorCursorsAt(
  //   path: Path
  // ): readonly {
  //   readonly interactor: Draft<Interactor>;
  //   readonly cursorType: InteractorAnchorType;
  // }[] {
  //   return this.commonInteractorCursorCollectionFunction(
  //     new Cursor(path, CursorOrientation.Before),
  //     CommonInteractorCursorCollectionFunctionBehavior.At
  //   );
  // }

  // public interactorCursorsAtOrAfter(
  //   cursor: Cursor
  // ): readonly {
  //   readonly interactor: Draft<Interactor>;
  //   readonly cursorType: InteractorAnchorType;
  // }[] {
  //   return this.commonInteractorCursorCollectionFunction(
  //     cursor,
  //     CommonInteractorCursorCollectionFunctionBehavior.AtOrAfter
  //   );
  // }

  // public interactorCursorsAtOrDescendantsOf(
  //   path: Path
  // ): readonly {
  //   readonly interactor: Draft<Interactor>;
  //   readonly cursorType: InteractorAnchorType;
  // }[] {
  //   return this.commonInteractorCursorCollectionFunction(
  //     new Cursor(path, CursorOrientation.Before),
  //     CommonInteractorCursorCollectionFunctionBehavior.AtOrDescendants
  //   );
  // }

  // public interactorCursorsDescendantsOf(
  //   path: Path
  // ): readonly {
  //   readonly interactor: Draft<Interactor>;
  //   readonly cursorType: InteractorAnchorType;
  // }[] {
  //   return this.commonInteractorCursorCollectionFunction(
  //     new Cursor(path, CursorOrientation.Before),
  //     CommonInteractorCursorCollectionFunctionBehavior.Descendants
  //   );
  // }

  public jiggleInteractors(services: EditorServices, all?: boolean): void {
    if (!this.editorState) {
      return;
    }

    const navHelper = new CursorNavigator(this.editorState.document, services.layout);

    function updateAnchor(interactor: Draft<Interactor>, anchorType: InteractorAnchorType) {
      const currentAnchor = interactor.getAnchor(anchorType);
      if (!currentAnchor) {
        return;
      }
      const currentCursor = currentAnchor.toCursor(services);
      if (currentCursor && !navHelper.navigateTo(currentCursor)) {
        return;
      }
      // if (navHelper.navigateToNextCursorPosition()) {
      //   navHelper.navigateToPrecedingCursorPosition();
      // }
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

  // public notifyUpdatedForced(id: InteractorId): void {
  //   this.updateInteractorOrderingFor(id);
  // }

  // private commonInteractorCursorCollectionFunction(
  //   startingCursor: Cursor,
  //   behavior: CommonInteractorCursorCollectionFunctionBehavior
  // ): readonly {
  //   readonly interactor: Draft<Interactor>;
  //   readonly cursorType: InteractorAnchorType;
  // }[] {
  //   if (!this.editorState) {
  //     return [];
  //   }

  //   const results = [];

  //   let startingIndex = binarySearch(this.editorState.interactorOrdering, startingCursor, this.findCursorComparator);

  //   if (startingIndex < 0) {
  //     // In this case the startingIndex is saying the target is (or would be)
  //     // BEFORE -1 * the startingIndex and AFTER -1 * startingIndex;
  //     startingIndex = (startingIndex + 1) * -1;
  //   }

  //   for (let i = startingIndex; i < this.editorState.interactorOrdering.length; i++) {
  //     const current = this.editorState.interactorOrdering[i];
  //     const interactor = this.editorState.interactors[current.id];

  //     const cursor = InteractorOrderingEntry.getCursor(interactor, current.cursorType);
  //     if (behavior === CommonInteractorCursorCollectionFunctionBehavior.At) {
  //       const cmp = cursor.path.compareTo(startingCursor.path);
  //       if (cmp !== PathComparison.Equal) {
  //         break;
  //       }
  //     } else if (behavior === CommonInteractorCursorCollectionFunctionBehavior.AtOrAfter) {
  //       // No-op
  //     } else if (behavior === CommonInteractorCursorCollectionFunctionBehavior.AtOrDescendants) {
  //       const cmp = cursor.path.compareTo(startingCursor.path);
  //       if (cmp !== PathComparison.Equal && cmp !== PathComparison.Descendent) {
  //         break;
  //       }
  //     } else if (behavior === CommonInteractorCursorCollectionFunctionBehavior.Descendants) {
  //       const cmp = cursor.path.compareTo(startingCursor.path);
  //       if (cmp === PathComparison.Equal) {
  //         continue;
  //       }
  //       if (cmp !== PathComparison.Descendent) {
  //         break;
  //       }
  //     }

  //     results.push({ interactor, cursorType: current.cursorType });
  //   }
  //   return results;
  // }

  // private comparator = (a: InteractorOrderingEntry, b: InteractorOrderingEntry) => {
  // if (!this.editorState) {
  //   return NaN;
  // }
  // const ai = this.editorState.interactors[a.id];
  // const bi = this.editorState.interactors[b.id];

  // const afc = a.cursorType === InteractorAnchorType.SelectionAnchor ? ai.selectionAnchor : ai.mainAnchor;
  // const bfc = b.cursorType === InteractorAnchorType.SelectionAnchor ? bi.selectionAnchor : bi.mainAnchor;

  // if (!afc || !bfc) {
  //   return NaN;
  // }

  // switch (afc.compareTo(bfc)) {
  //   case SimpleComparison.Before:
  //     return -1;
  //   case SimpleComparison.After:
  //     return 1;
  //   default:
  //     // To make things deterministic and to make it easy to do deduplication
  //     // (on the ordered interactors) we also consider the status and type of
  //     // cursor when doing ordering.
  //     if (ai.status !== bi.status) {
  //       // Put active cursors before inactive ones
  //       if (ai.status === InteractorStatus.Inactive) {
  //         return 1;
  //       }
  //       return -1;
  //     }
  //     if (a.cursorType !== b.cursorType) {
  //       // Put main cursors before selection anchor cursors
  //       if (a.cursorType === InteractorAnchorType.SelectionAnchor) {
  //         return 1;
  //       }
  //       return -1;
  //     }
  //     // Finally put main cursors that have a selection after main cursors that don't
  //     if (a.cursorType === InteractorAnchorType.Main) {
  //       if (ai.isSelection !== bi.isSelection) {
  //         if (ai.isSelection) {
  //           return 1;
  //         }
  //         return -1;
  //       }
  //     }
  //     return 0;
  // }
  // };

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
      dupeIds?.forEach((id) => {
        delete this.editorState!.interactors[id];
        if (this.editorState!.focusedInteractorId === id) {
          this.editorState!.focusedInteractorId = undefined;
        }
      });
    }
    return dupeIds;
  }

  // private findCursorComparator = (a: InteractorOrderingEntry, needle: Cursor) => {
  //   if (!this.editorState) {
  //     return NaN;
  //   }
  //   const ai = this.editorState.interactors[a.id];

  //   const afc = a.cursorType === InteractorAnchorType.SelectionAnchor ? ai.selectionAnchor : ai.mainAnchor;

  //   if (!afc) {
  //     return NaN;
  //   }

  //   switch (afc.compareTo(needle)) {
  //     case SimpleComparison.Before:
  //       return -1;
  //     case SimpleComparison.After:
  //       return 1;
  //     default:
  //       return 0;
  //   }
  // };

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

  // private updateInteractorOrderingFor = (id: InteractorId) => {
  //   const interactor = this.editorState!.interactors[id];
  //   if (!interactor) {
  //     return;
  //   }
  //   const oldInteractor = original(interactor);
  //   if (interactor === oldInteractor) {
  //     return;
  //   }

  //   // Take care of selectionAnchorCursor changes (if it was undefined or is now undefined)
  //   if (!oldInteractor?.selectionAnchor && interactor.selectionAnchor) {
  //     const newSelectionEntry = { id, cursorType: InteractorAnchorType.SelectionAnchor };
  //     const insertionPoint = binarySearch(this.editorState!.interactorOrdering, newSelectionEntry, this.comparator);
  //     this.editorState!.interactorOrdering.splice(
  //       insertionPoint >= 0 ? insertionPoint : (insertionPoint + 1) * -1,
  //       0,
  //       newSelectionEntry
  //     );
  //   } else if (oldInteractor?.selectionAnchor && !interactor.selectionAnchor) {
  //     const selectionEntryIndex = this.editorState!.interactorOrdering.findIndex(
  //       (entry) => entry.id === id && entry.cursorType === InteractorAnchorType.SelectionAnchor
  //     );
  //     if (selectionEntryIndex >= 0) {
  //       this.editorState!.interactorOrdering.splice(selectionEntryIndex, 1);
  //     }
  //   }
  // };
}
