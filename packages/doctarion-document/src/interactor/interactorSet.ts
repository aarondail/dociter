/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { immerable } from "immer";

import { Cursor } from "../cursor";
import { HorizontalAnchor } from "../layout-reporting";
import { SimpleComparison } from "../miscUtils";

import { Interactor, InteractorId, InteractorStatus } from "./interactor";

export interface InteractorUpdateParams {
  readonly mainCursor?: Cursor;
  readonly selectionAnchorCursor?: Cursor;
  readonly status?: InteractorStatus;
  readonly visualLineMovementHorizontalAnchor?: HorizontalAnchor;
}

export class InteractorSet {
  public readonly byId: { readonly [id: string]: Interactor };
  public readonly focusedId: InteractorId | undefined;
  [immerable] = true;
  /**
   * All interactors ordered by their forward cursor position and status.
   *
   * The forward cursor position can be either the mainCursor of the
   * selectionAnchorCursor, depending on which is first in the document.
   */
  public readonly ordered: readonly InteractorId[];

  public constructor();
  constructor(
    byId?: { readonly [id: string]: Interactor },
    focusedId?: InteractorId | undefined,
    ordered?: readonly InteractorId[]
  ) {
    this.byId = byId ?? {};
    this.focusedId = focusedId;
    this.ordered = ordered ?? [];
  }

  public get count(): number {
    return this.ordered.length;
  }

  public addInteractor(newInteractor: Interactor): InteractorSet {
    const byId = { ...this.byId, [newInteractor.id]: newInteractor };
    const ordered = [...this.ordered, newInteractor.id];
    ordered.sort(InteractorSet.sortHelper(byId));
    return new (InteractorSet as any)(byId, this.focusedId, ordered);
  }

  public deleteInteractor(id: InteractorId): InteractorSet {
    const byId = { ...this.byId };
    delete byId[id];
    const index = this.ordered.indexOf(id);
    let ordered;
    if (index !== -1) {
      ordered = [...this.ordered];
      ordered.splice(index, 1);
    } else {
      ordered = this.ordered;
    }
    return new (InteractorSet as any)(byId, this.focusedId === id ? undefined : this.focusedId, ordered);
  }

  public deleteInteractors(ids: InteractorId[]): InteractorSet {
    const byId = { ...this.byId };
    const ordered = [...this.ordered];
    let clearFocus = false;
    for (const id of ids) {
      delete byId[id];
      const index = this.ordered.indexOf(id);
      if (index !== -1) {
        ordered.splice(index, 1);
      }
      if (this.focusedId === id) {
        clearFocus = true;
      }
    }
    return new (InteractorSet as any)(byId, clearFocus ? undefined : this.focusedId, ordered);
  }

  public get focused(): Interactor | undefined {
    if (this.focusedId) {
      return this.byId[this.focusedId];
    }
  }

  public setFocused(id: InteractorId | undefined): InteractorSet {
    return new (InteractorSet as any)(this.byId, id, this.ordered);
  }

  public updateInteractor(id: InteractorId, updates: InteractorUpdateParams): InteractorSet {
    return this.updateInteractors([[id, updates]]);
  }

  public updateInteractors(updates: readonly [InteractorId, InteractorUpdateParams][]): InteractorSet {
    const byId = { ...this.byId };

    updates.forEach(([id, updates]) => {
      const existingInteractor = this.byId[id];
      if (!existingInteractor) {
        return;
      }

      const newInteractor = new Interactor(
        id,
        updates.mainCursor ?? existingInteractor.mainCursor,
        updates.status ?? existingInteractor.status,
        "selectionAnchorCursor" in updates ? updates.selectionAnchorCursor : existingInteractor.selectionAnchorCursor,
        updates.visualLineMovementHorizontalAnchor ?? existingInteractor.visualLineMovementHorizontalAnchor
      );

      byId[id] = newInteractor;
    });

    let newOrdered;
    if (this.ordered.length > 1) {
      const ordered = [...this.ordered];
      ordered.sort(InteractorSet.sortHelper(byId));
      newOrdered = ordered;
    } else {
      newOrdered = this.ordered;
    }

    return new (InteractorSet as any)(byId, this.focusedId, newOrdered);
  }

  private static sortHelper = (map: { [id: string]: Interactor }) => (a: InteractorId, b: InteractorId) => {
    const ai = map[a];
    const bi = map[b];

    const afc = ai.forwardCursor;
    const bfc = bi.forwardCursor;

    switch (afc.compareTo(bfc)) {
      case SimpleComparison.Before:
        return -1;
      case SimpleComparison.After:
        return 1;
      default:
        // Now compare status
        if (ai.status !== bi.status) {
          // Just to make things deterministic, inactive Interactors go before
          // Active ones
          if (ai.status === InteractorStatus.Active) {
            return 1;
          }
          return -1;
        }
        return 0;
    }
  };
}