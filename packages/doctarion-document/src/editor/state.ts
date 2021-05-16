import { immerable } from "immer";

import { NodeNavigator, SimplePathComparison } from "../basic-traversal";
import { Cursor, CursorOrientation } from "../cursor";
import { HorizontalAnchor } from "../layout-reporting";
import { Document } from "../models";
import { Range } from "../ranges";

import { NodeId } from "./nodeId";

export enum EditorInteractorStatus {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
}

export class EditorInteractor {
  [immerable] = true;

  /**
   * When moving between lines visually, this value stores cursor's x value at
   * the start of the line movement, so we can intelligently move between lines
   * of different length and have the cursor try to go to the right spot.
   */
  public readonly visualLineMovementHorizontalAnchor?: HorizontalAnchor;

  public constructor(
    public readonly mainCursor: Cursor,
    public readonly status: EditorInteractorStatus = EditorInteractorStatus.Active,
    public readonly selectionAnchorCursor?: Cursor // TODO need direction
  ) {}

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
      if (!n.navigateTo(fromPath) || !n.navigateForwardsInDfs()) {
        return undefined;
      }
      fromPath = n.path;
    }

    let toPath = this.selectionAnchorCursor.path;
    if (this.mainCursor.orientation === CursorOrientation.Before) {
      const n = new NodeNavigator(document);
      if (!n.navigateTo(toPath) || !n.navigateBackwardsInDfs()) {
        return undefined;
      }
      toPath = n.path;
    }

    if (fromPath.compareToSimple(toPath) === SimplePathComparison.After) {
      const temp = fromPath;
      fromPath = toPath;
      toPath = temp;
    }

    return new Range(fromPath, toPath);
  }
}

export interface EditorState {
  readonly document: Document;
  readonly interactors: readonly EditorInteractor[];
  /**
   * This isn't relevant to editing per se, but lets the UI track which
   * interactor to prioritize displaying.
   */
  readonly focusedInteractor?: number;

  // This big long object may be a poor fit for immer... not sure what to do about it though
  readonly nodeParentMap: { readonly [id: string /* NodeId */]: NodeId | undefined };
}
