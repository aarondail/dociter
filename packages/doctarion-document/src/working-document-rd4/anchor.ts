import { Anchor, AnchorOrientation } from "../document-model-rd4";
import { DeepReadonly } from "../miscUtils";

import { InteractorId } from "./interactor";
import { WorkingNode } from "./nodes";

export type AnchorId = string;

// export interface AnchorPosition {
//   readonly node: WorkingNode;
//   readonly orientation: AnchorOrientation;
//   readonly graphemeIndex?: number;
// }

export class WorkingAnchor extends Anchor {
  // implements AnchorPosition {
  public constructor(
    public id: AnchorId,
    public node: WorkingNode,
    public orientation: AnchorOrientation,
    public graphemeIndex?: number,
    public name?: string,
    public relatedInteractorId?: InteractorId
  ) {
    super(node, orientation, graphemeIndex);
  }
}

export type ReadonlyWorkingAnchor = DeepReadonly<WorkingAnchor>;

// export interface ReadonlyWorkingAnchor extends Anchor {
//   readonly id: AnchorId;
//   readonly name?: string;
//   readonly node: ReadonlyWorkingNode;
//   readonly relatedInteractorId?: InteractorId;
// }
