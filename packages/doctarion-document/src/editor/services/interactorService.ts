/* eslint-disable @typescript-eslint/no-non-null-assertion */
import binarySearch from "binary-search";
import { Draft, castDraft, original } from "immer";

import { Path, PathComparison } from "../../basic-traversal";
import { Cursor, CursorOrientation } from "../../cursor";
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

    const newMainEntry = { id: newInteractor.id, cursor: InteractorOrderingEntryCursorType.Main };
    const insertionPoint = binarySearch(this.editorState.interactorOrdering, newMainEntry, this.comparator);

    if (insertionPoint >= 0) {
      // This means that there was an exact match with another existing main
      // cursor... the only material thing that could be different is the
      // selection anchor. We don't really want to add a duplicate. Its a little
      // murky what is the best thing to do in the case of selections so we just
      // deal w/ non selections here.
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

  public interactorCursorsAt(
    path: Path
  ): readonly {
    readonly interactor: Draft<Interactor>;
    readonly cursorType: InteractorOrderingEntryCursorType;
  }[] {
    if (!this.editorState) {
      return [];
    }

    const results = [];

    let startingIndex = binarySearch(
      this.editorState.interactorOrdering,
      new Cursor(path, CursorOrientation.Before),
      this.findCursorComparator
    );

    if (startingIndex < 0) {
      // In this case the startingIndex is saying the target is (or would be)
      // BEFORE -1 * the startingIndex and AFTER -1 * startingIndex;
      startingIndex = (startingIndex + 1) * -1;
    }

    for (let i = startingIndex; i < this.editorState.interactorOrdering.length; i++) {
      const current = this.editorState.interactorOrdering[i];
      const interactor = this.editorState.interactors[current.id];

      const cursor =
        current.cursor === InteractorOrderingEntryCursorType.Main
          ? interactor.mainCursor
          : interactor.selectionAnchorCursor!;
      const cmp = cursor.path.compareTo(path);
      if (cmp !== PathComparison.Equal) {
        break;
      }

      results.push({ interactor, cursorType: current.cursor });
    }
    return results;
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

  public interactorCursorsAtOrDescendantsOf(
    path: Path
  ): readonly {
    readonly interactor: Draft<Interactor>;
    readonly cursorType: InteractorOrderingEntryCursorType;
  }[] {
    if (!this.editorState) {
      return [];
    }

    const results = [];

    let startingIndex = binarySearch(
      this.editorState.interactorOrdering,
      new Cursor(path, CursorOrientation.Before),
      this.findCursorComparator
    );

    if (startingIndex < 0) {
      // In this case the startingIndex is saying the target is (or would be)
      // BEFORE -1 * the startingIndex and AFTER -1 * startingIndex;
      startingIndex = (startingIndex + 1) * -1;
    }

    for (let i = startingIndex; i < this.editorState.interactorOrdering.length; i++) {
      const current = this.editorState.interactorOrdering[i];
      const interactor = this.editorState.interactors[current.id];

      const cursor =
        current.cursor === InteractorOrderingEntryCursorType.Main
          ? interactor.mainCursor
          : interactor.selectionAnchorCursor!;
      const cmp = cursor.path.compareTo(path);
      // The only diff from the following function is here (omitting the equal check)
      if (cmp !== PathComparison.Equal && cmp !== PathComparison.Descendent) {
        break;
      }

      results.push({ interactor, cursorType: current.cursor });
    }
    return results;
  }

  public interactorCursorsDescendantsOf(
    path: Path
  ): readonly {
    readonly interactor: Draft<Interactor>;
    readonly cursorType: InteractorOrderingEntryCursorType;
  }[] {
    if (!this.editorState) {
      return [];
    }

    const results = [];

    let startingIndex = binarySearch(
      this.editorState.interactorOrdering,
      new Cursor(path, CursorOrientation.Before),
      this.findCursorComparator
    );

    if (startingIndex < 0) {
      // In this case the startingIndex is saying the target is (or would be)
      // BEFORE -1 * the startingIndex and AFTER -1 * startingIndex;
      startingIndex = (startingIndex + 1) * -1;
    }

    for (let i = startingIndex; i < this.editorState.interactorOrdering.length; i++) {
      const current = this.editorState.interactorOrdering[i];
      const interactor = this.editorState.interactors[current.id];

      const cursor =
        current.cursor === InteractorOrderingEntryCursorType.Main
          ? interactor.mainCursor
          : interactor.selectionAnchorCursor!;
      const cmp = cursor.path.compareTo(path);
      if (cmp === PathComparison.Equal) {
        continue;
      }
      if (cmp !== PathComparison.Descendent) {
        break;
      }

      results.push({ interactor, cursorType: current.cursor });
    }
    return results;
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
   * interactors, but for right now we only dedupe interactors that aren't a
   * selection AND have the same status AND their mainCursor is equal.
   *
   * This must be called after the interactorOrdering has been sorted.
   */
  private dedupe(): InteractorId[] | undefined {
    if (!this.editorState) {
      return;
    }

    // Dedupe
    let dupeIndices: number[] | undefined;
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
        if (!dupeIndices) {
          dupeIndices = [];
          dupeIds = [];
        }
        dupeIndices.unshift(i + 1);
        dupeIds!.push(b.id);
      }
    }

    if (dupeIndices) {
      // Note this is in reverse order!
      // Also note that because we ONLY dedupe interactors that are not
      // selections we only ever have one entry to delete from this array
      dupeIndices.forEach((index) => this.editorState!.interactorOrdering.splice(index, 1));
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

    switch (afc.compareTo(needle)) {
      case SimpleComparison.Before:
        return -1;
      case SimpleComparison.After:
        return 1;
      default:
        return 0;
    }
  };

  private handleOperationHasCompleted = () => {
    this.editorState = null;
    this.updatedInteractors = null;
  };

  private handleOperationHasRun = () => {
    if (this.updatedInteractors) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      for (const id of this.updatedInteractors) {
        this.updateInteractorOrderingFor(id);
      }
      // Then take care of status and cursor position changes by just doing the
      // simplest thing possible and resorting the ordered iterators.
      this.editorState?.interactorOrdering.sort(this.comparator);
      this.dedupe();
    }
  };

  private handleOperationWillRun = (newState: Draft<EditorState>) => {
    this.editorState = newState;
  };

  private updateInteractorOrderingFor = (id: InteractorId) => {
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
