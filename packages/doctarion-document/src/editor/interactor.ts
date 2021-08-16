import { immerable } from "immer";

import { HorizontalVisualAnchor } from "../layout-reporting";

import { Anchor } from "./anchor";

export type InteractorId = string;

export enum InteractorStatus {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
}

export enum InteractorAnchorType {
  Main = "MAIN",
  SelectionAnchor = "SELECTION_ANCHOR",
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
    public readonly lineMovementHorizontalVisualAnchor?: HorizontalVisualAnchor,
    /**
     * Optional name to describe the interactor.
     */
    public readonly name?: string
  ) {}

  public getAnchor(type: InteractorAnchorType): Anchor | undefined {
    return type === InteractorAnchorType.Main ? this.mainAnchor : this.selectionAnchor;
  }

  public get isSelection(): boolean {
    return this.selectionAnchor !== undefined;
  }
}

export interface InteractorOrderingEntry {
  readonly id: InteractorId;
  readonly cursorType: InteractorAnchorType;
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
