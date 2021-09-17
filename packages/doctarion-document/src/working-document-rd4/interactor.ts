import { HorizontalVisualPosition } from "../cursor";

import { AnchorId } from "./anchor";

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
  public constructor(
    public id: InteractorId,
    public mainAnchor: AnchorId,
    public status: InteractorStatus = InteractorStatus.Active,
    public selectionAnchor?: AnchorId,
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

  public getAnchor(type: InteractorAnchorType): AnchorId | undefined {
    return type === InteractorAnchorType.Main ? this.mainAnchor : this.selectionAnchor;
  }
}

export interface ReadonlyInteractor {
  readonly id: InteractorId;
  readonly mainAnchor: AnchorId;
  readonly status: InteractorStatus;
  readonly selectionAnchor?: AnchorId;
  readonly lineMovementHorizontalVisualPosition?: HorizontalVisualPosition;
  readonly name?: string;
}
