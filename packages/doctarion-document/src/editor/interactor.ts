import { immerable } from "immer";

import { NodeNavigator, Range } from "../basic-traversal";
import { Cursor, CursorOrientation } from "../cursor";
import { HorizontalVisualAnchor } from "../layout-reporting";
import { SimpleComparison } from "../miscUtils";
import { Document } from "../models";

import { Anchor } from "./anchor";

export type InteractorId = string;

export enum InteractorStatus {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
}

export class Interactor {
  [immerable] = true;

  public constructor(
    public readonly id: InteractorId,
    public readonly mainAnchor: Anchor,
    public readonly status: InteractorStatus = InteractorStatus.Active,
    public readonly selectionAnchor?: Anchor,
    /**
     * When moving between lines visually, this value stores cursor's x value at
     * the start of the line movement, so we can intelligently move between lines
     * of different length and have the cursor try to go to the right spot.
     */
    public readonly lineMovementHorizontalVisualAnchor?: HorizontalVisualAnchor
  ) {}

  public get isSelection(): boolean {
    return this.selectionAnchor !== undefined;
  }

  public getSelectionCursorsOrdered():
    | { readonly cursors: [Cursor, Cursor]; readonly isMainCursorFirst: boolean }
    | undefined {
    if (!this.selectionAnchor) {
      return undefined;
    }

    if (this.mainAnchor.compareTo(this.selectionAnchor) === SimpleComparison.After) {
      return { cursors: [this.selectionAnchor, this.mainAnchor], isMainCursorFirst: false };
    }
    return { cursors: [this.mainAnchor, this.selectionAnchor], isMainCursorFirst: true };
  }

  public toRange(document: Document): Range | undefined {
    if (!this.selectionAnchor) {
      return undefined;
    }

    const mainAfterSelect = this.mainAnchor.compareTo(this.selectionAnchor) === SimpleComparison.After;
    let fromPath = mainAfterSelect ? this.selectionAnchor.path : this.mainAnchor.path;
    if (
      (mainAfterSelect ? this.selectionAnchor.orientation : this.mainAnchor.orientation) === CursorOrientation.After
    ) {
      const n = new NodeNavigator(document);
      if (!n.navigateTo(fromPath) || !n.navigateForwardsByDfs()) {
        return undefined;
      }
      fromPath = n.path;
    }

    let toPath = mainAfterSelect ? this.mainAnchor.path : this.selectionAnchor.path;
    if (
      (mainAfterSelect ? this.mainAnchor.orientation : this.selectionAnchor.orientation) === CursorOrientation.Before
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
  // getCursor(interactor: Interactor, cursorType: InteractorOrderingEntryCursorType): Cursor {
  //   return cursorType === InteractorOrderingEntryCursorType.Main
  //     ? interactor.mainAnchor
  //     : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  //       interactor.selectionAnchor!;
  // },
  // setCursor(interactor: Draft<Interactor>, cursorType: InteractorOrderingEntryCursorType, cursor: Cursor): void {
  //   if (cursorType === InteractorOrderingEntryCursorType.Main) {
  //     interactor.mainAnchor = castDraft(cursor);
  //   } else {
  //     interactor.selectionAnchor = castDraft(cursor);
  //   }
  // },
};
