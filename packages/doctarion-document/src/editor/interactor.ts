import { immerable } from "immer";

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

  /**
   * This returns either the mainCursor or the selectionAnchorCursor depending
   * on which one preceeds the other.
   */
  public get forwardCursor(): Cursor {
    if (!this.selectionAnchorCursor) {
      return this.mainCursor;
    }

    if (this.mainCursor.compareTo(this.selectionAnchorCursor) === SimpleComparison.After) {
      return this.selectionAnchorCursor;
    }
    return this.mainCursor;
  }

  public get isSelection(): boolean {
    return this.selectionAnchorCursor !== undefined;
  }

  public toRange(document: Document): Range | undefined {
    if (!this.selectionAnchorCursor) {
      return undefined;
    }

    let fromPath = this.mainCursor.path;
    if (this.mainCursor.orientation === CursorOrientation.After) {
      const n = new NodeNavigator(document);
      if (!n.navigateTo(fromPath) || !n.navigateForwardsByDfs()) {
        return undefined;
      }
      fromPath = n.path;
    }

    let toPath = this.selectionAnchorCursor.path;
    if (this.mainCursor.orientation === CursorOrientation.Before) {
      const n = new NodeNavigator(document);
      if (!n.navigateTo(toPath) || !n.navigateBackwardsByDfs()) {
        return undefined;
      }
      toPath = n.path;
    }

    if (fromPath.compareToSimple(toPath) === SimpleComparison.After) {
      const temp = fromPath;
      fromPath = toPath;
      toPath = temp;
    }

    return new Range(fromPath, toPath);
  }
}

export enum InteractorOrderingEntryCursor {
  Main = "MAIN",
  SelectionAnchor = "SELECTION_ANCHOR",
}

export interface InteractorOrderingEntry {
  readonly id: InteractorId;
  readonly cursor: InteractorOrderingEntryCursor;
}
