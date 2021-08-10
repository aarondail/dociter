import { Draft, castDraft, immerable } from "immer";

import { NodeNavigator, Range } from "../basic-traversal";
import { Cursor, CursorOrientation } from "../cursor";
import { HorizontalAnchor } from "../layout-reporting";
import { SimpleComparison } from "../miscUtils";
import { Document } from "../models";

export type InteractorId = string;

export enum InteractorStatus {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
}

export class Interactor {
  [immerable] = true;

  public constructor(
    public readonly id: InteractorId,
    public readonly mainCursor: Cursor,
    public readonly status: InteractorStatus = InteractorStatus.Active,
    public readonly selectionAnchorCursor?: Cursor,
    /**
     * When moving between lines visually, this value stores cursor's x value at
     * the start of the line movement, so we can intelligently move between lines
     * of different length and have the cursor try to go to the right spot.
     */
    public readonly visualLineMovementHorizontalAnchor?: HorizontalAnchor
  ) {}

  public get isSelection(): boolean {
    return this.selectionAnchorCursor !== undefined;
  }

  /**
   * This returns either the mainCursor and selectionAnchorCursor, or the
   * selectionAnchorCursor and mainCursor, depending on which one precedes the
   * other. If the Interactor is not a selection `undefined` is returned.
   */
  public getSelectionCursorsOrdered():
    | { readonly cursors: [Cursor, Cursor]; readonly isMainCursorFirst: boolean }
    | undefined {
    if (!this.selectionAnchorCursor) {
      return undefined;
    }

    if (this.mainCursor.compareTo(this.selectionAnchorCursor) === SimpleComparison.After) {
      return { cursors: [this.selectionAnchorCursor, this.mainCursor], isMainCursorFirst: false };
    }
    return { cursors: [this.mainCursor, this.selectionAnchorCursor], isMainCursorFirst: true };
  }

  public toRange(document: Document): Range | undefined {
    if (!this.selectionAnchorCursor) {
      return undefined;
    }

    const mainAfterSelect = this.mainCursor.compareTo(this.selectionAnchorCursor) === SimpleComparison.After;
    let fromPath = mainAfterSelect ? this.selectionAnchorCursor.path : this.mainCursor.path;
    if (
      (mainAfterSelect ? this.selectionAnchorCursor.orientation : this.mainCursor.orientation) ===
      CursorOrientation.After
    ) {
      const n = new NodeNavigator(document);
      if (!n.navigateTo(fromPath) || !n.navigateForwardsByDfs()) {
        return undefined;
      }
      fromPath = n.path;
    }

    let toPath = mainAfterSelect ? this.mainCursor.path : this.selectionAnchorCursor.path;
    if (
      (mainAfterSelect ? this.mainCursor.orientation : this.selectionAnchorCursor.orientation) ===
      CursorOrientation.Before
    ) {
      const n = new NodeNavigator(document);
      if (!n.navigateTo(toPath) || !n.navigateBackwardsByDfs()) {
        return undefined;
      }
      toPath = n.path;
    }

    return new Range(fromPath, toPath);
  }
}

export enum InteractorOrderingEntryCursorType {
  Main = "MAIN",
  SelectionAnchor = "SELECTION_ANCHOR",
}

export interface InteractorOrderingEntry {
  readonly id: InteractorId;
  readonly cursorType: InteractorOrderingEntryCursorType;
}

export const InteractorOrderingEntry = {
  getCursor(interactor: Interactor, cursorType: InteractorOrderingEntryCursorType): Cursor {
    return cursorType === InteractorOrderingEntryCursorType.Main
      ? interactor.mainCursor
      : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        interactor.selectionAnchorCursor!;
  },

  setCursor(interactor: Draft<Interactor>, cursorType: InteractorOrderingEntryCursorType, cursor: Cursor): void {
    if (cursorType === InteractorOrderingEntryCursorType.Main) {
      interactor.mainCursor = castDraft(cursor);
    } else {
      interactor.selectionAnchorCursor = castDraft(cursor);
    }
  },
};
