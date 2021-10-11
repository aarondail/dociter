import { HorizontalVisualPosition } from "../cursor";

import { AnchorPayload, ReadonlyWorkingAnchor, WorkingAnchor } from "./anchor";

export type InteractorId = string;

export enum InteractorStatus {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
}

export enum InteractorAnchorType {
  Main = "MAIN",
  SelectionAnchor = "SELECTION_ANCHOR",
}

export interface InteractorPayload {
  readonly mainAnchor: Omit<AnchorPayload, "name">;
  readonly status: InteractorStatus;
  readonly selectionAnchor?: Omit<AnchorPayload, "name">;
  /**
   * When moving between lines visually, this value stores cursor's x value at
   * the start of the line movement, so we can intelligently move between lines
   * of different length and have the cursor try to go to the right spot.
   */
  readonly lineMovementHorizontalVisualPosition?: HorizontalVisualPosition;
  readonly name?: string;
}

export class Interactor {
  public constructor(
    public id: InteractorId,
    public mainAnchor: WorkingAnchor,
    public status: InteractorStatus = InteractorStatus.Active,
    public selectionAnchor?: WorkingAnchor,
    /**
     * When moving between lines visually, this value stores cursor's x value at
     * the start of the line movement, so we can intelligently move between lines
     * of different length and have the cursor try to go to the right spot.
     */
    public lineMovementHorizontalVisualPosition?: HorizontalVisualPosition,
    /**
     * Optional name to describe the interactor.
     */
    public name?: string
  ) {}

  public get isSelection(): boolean {
    return this.selectionAnchor !== undefined;
  }
}

export interface ReadonlyInteractor {
  readonly id: InteractorId;
  readonly mainAnchor: ReadonlyWorkingAnchor;
  readonly status: InteractorStatus;
  readonly selectionAnchor?: ReadonlyWorkingAnchor;
  readonly lineMovementHorizontalVisualPosition?: HorizontalVisualPosition;
  readonly name?: string;
}
