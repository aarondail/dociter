import { Anchor, AnchorOrientation, AnchorRange } from "../document-model-rd4";
import { DeepReadonly } from "../miscUtils";

import { Interactor, InteractorId, ReadonlyInteractor } from "./interactor";
import { NodeId, ReadonlyWorkingNode, WorkingNode } from "./nodes";

export type AnchorId = string;

export interface AnchorPayload {
  readonly node: NodeId | WorkingNode;
  readonly orientation: AnchorOrientation;
  readonly graphemeIndex?: number;
  readonly name?: string;
}

export class WorkingAnchor extends Anchor {
  // implements AnchorPosition {
  public constructor(
    public id: AnchorId,
    public node: WorkingNode,
    public orientation: AnchorOrientation,
    public graphemeIndex?: number,
    public name?: string,
    public relatedInteractor?: Interactor
  ) {
    super(node, orientation, graphemeIndex);
  }
}

export interface ReadonlyWorkingAnchor extends Anchor {
  readonly id: AnchorId;
  readonly node: ReadonlyWorkingNode;
  readonly orientation: AnchorOrientation;
  readonly graphemeIndex?: number;
  readonly name?: string;
  readonly relatedInteractor?: ReadonlyInteractor;
}

export class WorkingAnchorRange implements AnchorRange {
  public constructor(public anterior: WorkingAnchor, public posterior: WorkingAnchor) {}
}

export interface ReadonlyWorkingAnchorRange {
  readonly anterior: ReadonlyWorkingAnchor;
  readonly posterior: ReadonlyWorkingAnchor;
}