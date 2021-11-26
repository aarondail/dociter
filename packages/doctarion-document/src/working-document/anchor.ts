import { Anchor, AnchorOrientation, AnchorRange } from "../document-model";

import { ReadonlyWorkingInteractor, WorkingInteractor } from "./interactor";
import { NodeId, ReadonlyWorkingNode, WorkingNode } from "./nodes";

export type AnchorId = string;

export interface AnchorParameters {
  readonly node: NodeId | ReadonlyWorkingNode;
  readonly orientation: AnchorOrientation;
  readonly graphemeIndex?: number;
  readonly name?: string;
}

export enum WorkingAnchorType {
  Node = "NODE",
  Interactor = "INTERACTOR",
  Transient = "TRANSIENT",
  Free = "FREE",
}

export class WorkingAnchor extends Anchor {
  public constructor(
    public id: AnchorId,
    public node: WorkingNode,
    public orientation: AnchorOrientation,
    public graphemeIndex: number | undefined,
    public type: WorkingAnchorType,
    public name?: string,
    public relatedInteractor?: WorkingInteractor,
    public relatedOriginatingNode?: WorkingNode
  ) {
    super(node, orientation, graphemeIndex);
  }
}

export interface ReadonlyWorkingAnchor extends Anchor {
  readonly id: AnchorId;
  readonly node: ReadonlyWorkingNode;
  readonly orientation: AnchorOrientation;
  readonly graphemeIndex?: number;
  readonly type: WorkingAnchorType;
  readonly name?: string;
  readonly relatedInteractor?: ReadonlyWorkingInteractor;
  readonly relatedOriginatingNode?: ReadonlyWorkingNode;
}

export class WorkingAnchorRange implements AnchorRange {
  public constructor(public from: WorkingAnchor, public to: WorkingAnchor) {}
}

export interface ReadonlyWorkingAnchorRange {
  readonly from: ReadonlyWorkingAnchor;
  readonly to: ReadonlyWorkingAnchor;
}
