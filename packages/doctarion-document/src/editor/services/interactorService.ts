/* eslint-disable @typescript-eslint/no-non-null-assertion */
import binarySearch from "binary-search";
import { Draft, castDraft, original } from "immer";

import { Cursor } from "../../cursor";
import { SimpleComparison } from "../../miscUtils";
import { EditorEvents } from "../events";
import {
  Interactor,
  InteractorId,
  InteractorOrderingEntry,
  InteractorOrderingEntryCursorType,
  InteractorStatus,
} from "../interactor";
import { EditorState } from "../state";

/**
 * This manages all interactors.
 *
 * This is intended to _only_ be used by `EditorOperation` functions.
 */
export class EditorInteractorService {
  private editorState: Draft<EditorState> | null;

  public constructor(private readonly editorEvents: EditorEvents) {
    this.editorState = null;
    this.editorEvents.updateStart.addListener(this.handleEditorUpdateStart);
    this.editorEvents.updateDone.addListener(this.handleEditorUpdateDone);
  }

  public add(newInteractor: Interactor): boolean {
    if (!this.editorState) {
      return false;
    }
    this.editorState.interactors[newInteractor.id] = castDraft(newInteractor);

    const newMainEntry = { id: newInteractor.id, cursor: InteractorOrderingEntryCursorType.Main };
    const insertionPoint = binarySearch(this.editorState.interactorOrdering, newMainEntry, this.comparator);

    if (insertionPoint >= 0) {
      // This means that there was an exact match with another existing main
      // cursor... the only material thing that could be different is the
      // selection anchor. We don't really want to add a duplicate. Its a little
      // murky what is the best thing to do in the case of selections so we just
      // deal w/ non selctions here.
      if (!newInteractor.isSelection) {
        return false;
      }
    }

    this.editorState.interactorOrdering.splice(
      insertionPoint >= 0 ? insertionPoint : (insertionPoint + 1) * -1,
      0,
      newMainEntry
    );

    if (newInteractor.selectionAnchorCursor) {
      const newSelectionEntry = { id: newInteractor.id, cursor: InteractorOrderingEntryCursorType.SelectionAnchor };
      const insertionPoint = binarySearch(this.editorState.interactorOrdering, newSelectionEntry, this.comparator);
      this.editorState.interactorOrdering.splice(
        insertionPoint >= 0 ? insertionPoint : (insertionPoint + 1) * -1,
        0,
        newSelectionEntry
      );
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

    const mainEntry = { id, cursor: InteractorOrderingEntryCursorType.Main };
    const mainEntryIndex = binarySearch(this.editorState.interactorOrdering, mainEntry, this.comparator);
    if (mainEntryIndex >= 0) {
      this.editorState.interactorOrdering.splice(mainEntryIndex, 1);
    }

    if (interactor.selectionAnchorCursor) {
      const newSelectionEntry = { id, cursor: InteractorOrderingEntryCursorType.SelectionAnchor };
      const selectionEntryIndex = binarySearch(this.editorState.interactorOrdering, newSelectionEntry, this.comparator);
      if (selectionEntryIndex >= 0) {
        this.editorState.interactorOrdering.splice(selectionEntryIndex, 1);
      }
    }

    delete this.editorState.interactors[id];
  }

  public interactorCursorsAtOrAfter(
    cursor: Cursor
  ): readonly {
    readonly interactor: Draft<Interactor>;
    readonly cursorType: InteractorOrderingEntryCursorType;
  }[] {
    if (!this.editorState) {
      return [];
    }

    const results = [];
    // console.log(immer.current(this.editorState.interactorOrdering));
    // console.log(
    //   Object.values(this.editorState.interactors)[0].mainCursor.path.toString(),
    //   Object.values(this.editorState.interactors)[0].mainCursor.orientation
    // );

    let startingIndex = binarySearch(this.editorState.interactorOrdering, cursor, this.findCursorComparator);

    if (startingIndex < 0) {
      // In this case the startingIndex is saying the target is (or would be)
      // BEFORE -1 * the startingIndex and AFTER -1 * startingIndex;
      startingIndex = (startingIndex + 1) * -1;
    }

    for (let i = startingIndex; i < this.editorState.interactorOrdering.length; i++) {
      const current = this.editorState.interactorOrdering[i];
      const interactor = this.editorState.interactors[current.id];

      results.push({ interactor, cursorType: current.cursor });
    }
    return results;
  }

  public notifyUpdated(id: InteractorId | InteractorId[]): void {
    if (!this.editorState) {
      return;
    }

    if (typeof id === "string") {
      this.notifyUpdatedCore(id);
    } else {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      id.forEach(this.notifyUpdatedCore);
    }

    // Then take care of status and cursor position changes by just doing the
    // simplest thing possible and resorting the ordered iterators.
    this.editorState.interactorOrdering.sort(this.comparator);

    this.dedupe();
  }

  private comparator = (a: InteractorOrderingEntry, b: InteractorOrderingEntry) => {
    if (!this.editorState) {
      return NaN;
    }
    const ai = this.editorState.interactors[a.id];
    const bi = this.editorState.interactors[b.id];

    const afc =
      a.cursor === InteractorOrderingEntryCursorType.SelectionAnchor ? ai.selectionAnchorCursor : ai.mainCursor;
    const bfc =
      b.cursor === InteractorOrderingEntryCursorType.SelectionAnchor ? bi.selectionAnchorCursor : bi.mainCursor;

    if (!afc || !bfc) {
      return NaN;
    }

    switch (afc.compareTo(bfc)) {
      case SimpleComparison.Before:
        return -1;
      case SimpleComparison.After:
        return 1;
      default:
        // To make things deterministic and to make it easy to do deduplication
        // (on the ordered interactors) we also consider the status and type of
        // cursor when doing ordering.
        if (ai.status !== bi.status) {
          // Put active cursors before inactive ones
          if (ai.status === InteractorStatus.Inactive) {
            return 1;
          }
          return -1;
        }
        if (a.cursor !== b.cursor) {
          // Put main cursors before selection anchor cursors
          if (a.cursor === InteractorOrderingEntryCursorType.SelectionAnchor) {
            return 1;
          }
          return -1;
        }
        // Finally put main cursors that have a selection after main cursors that don't
        if (a.cursor === InteractorOrderingEntryCursorType.Main) {
          if (ai.isSelection !== bi.isSelection) {
            if (ai.isSelection) {
              return 1;
            }
            return -1;
          }
        }
        return 0;
    }
  };

  /**
   * There definitely could be more situations in which we want to dedupe
   * interactors, but for right now we only dedupe interactors that ARENT a
   * selection AND have the same status AND their mainCursor is equal.
   *
   * This must be called after the interactorOrdering has been sorted.
   */
  private dedupe(): InteractorId[] | undefined {
    if (!this.editorState) {
      return;
    }

    // Dedupe
    let dupeIndecies: number[] | undefined;
    let dupeIds: InteractorId[] | undefined;
    for (let i = 0; i < this.editorState.interactorOrdering.length - 1; i++) {
      const a = this.editorState.interactorOrdering[i];
      const b = this.editorState.interactorOrdering[i + 1];
      // We don't care about deduping selections at this point since its unclear
      // what the best behavior is
      if (a.id === b.id || a.cursor === InteractorOrderingEntryCursorType.SelectionAnchor) {
        continue;
      }
      if (this.editorState.interactors[b.id].isSelection) {
        continue;
      }
      if (this.comparator(a, b) === 0) {
        // OK in this case the two interactors are materially the same. The only
        // possible difference would be that the selection anchor is different
        // but we have ruled that out actually by checking `isSelection` above
        // here.
        if (!dupeIndecies) {
          dupeIndecies = [];
          dupeIds = [];
        }
        dupeIndecies.unshift(i + 1);
        dupeIds!.push(b.id);
      }
    }

    if (dupeIndecies) {
      // Note this is in reverse order!
      // Also note that because we ONLY dedupe interactors that are not
      // selections we only ever have one entry to delete from this array
      dupeIndecies.forEach((index) => this.editorState!.interactorOrdering.splice(index, 1));
      dupeIds?.forEach((id) => {
        delete this.editorState!.interactors[id];
        if (this.editorState!.focusedInteractorId === id) {
          this.editorState!.focusedInteractorId = undefined;
        }
      });
    }
    return dupeIds;
  }

  private findCursorComparator = (a: InteractorOrderingEntry, needle: Cursor) => {
    if (!this.editorState) {
      return NaN;
    }
    const ai = this.editorState.interactors[a.id];

    const afc =
      a.cursor === InteractorOrderingEntryCursorType.SelectionAnchor ? ai.selectionAnchorCursor : ai.mainCursor;

    if (!afc) {
      return NaN;
    }

    const x = afc.compareTo(needle);
    // console.log("In binary search, comparing: ", afc.toString(), "to needle ", needle.toString(), " result => ", x);
    switch (afc.compareTo(needle)) {
      case SimpleComparison.Before:
        return -1;
      case SimpleComparison.After:
        return 1;
      default:
        return 0;
    }
  };

  private handleEditorUpdateDone = () => {
    this.editorState = null;
  };

  private handleEditorUpdateStart = (newState: Draft<EditorState>) => {
    this.editorState = newState;
  };

  private notifyUpdatedCore = (id: InteractorId) => {
    const interactor = this.editorState!.interactors[id];
    if (!interactor) {
      return;
    }
    const oldInteractor = original(interactor);
    if (interactor === oldInteractor) {
      return;
    }

    // Take care of selectionAnchorCursor changes (if it was undefined or is now undefined)
    if (!oldInteractor?.selectionAnchorCursor && interactor.selectionAnchorCursor) {
      const newSelectionEntry = { id, cursor: InteractorOrderingEntryCursorType.SelectionAnchor };
      const insertionPoint = binarySearch(this.editorState!.interactorOrdering, newSelectionEntry, this.comparator);
      this.editorState!.interactorOrdering.splice(
        insertionPoint >= 0 ? insertionPoint : (insertionPoint + 1) * -1,
        0,
        newSelectionEntry
      );
    } else if (oldInteractor?.selectionAnchorCursor && !interactor.selectionAnchorCursor) {
      const selectionEntryIndex = this.editorState!.interactorOrdering.findIndex(
        (entry) => entry.id === id && entry.cursor === InteractorOrderingEntryCursorType.SelectionAnchor
      );
      if (selectionEntryIndex >= 0) {
        this.editorState!.interactorOrdering.splice(selectionEntryIndex, 1);
      }
    }
  };
}
