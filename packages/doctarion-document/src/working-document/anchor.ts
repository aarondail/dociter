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
  /**
   * This is an Anchor owned by a Node (i.e., originating from a Node).
   */
  Node = "NODE",
  /**
   * This is an Anchor from an Interactor. Because this represents a cursor, and
   * certain cursor positions are preferred or invalid this will be updated a
   * little differently in case of node joins or deletions, sometimes.
   */
  Interactor = "INTERACTOR",
  /**
   * This is a Anchor created by the WorkingDocument to complete some operation.
   * It should be very short-lived.
   */
  Transient = "TRANSIENT",
  /**
   * This is a Anchor that does not fit into any of the above types and is
   * created by calling `WorkingDocument.addAnchor`.
   */
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
