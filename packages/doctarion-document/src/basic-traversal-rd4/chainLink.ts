import { Document } from "../document-model-rd4";

import { PathPart } from "./pathPart";
import { PseudoNode } from "./pseudoNode";

export class ChainLink<T extends PseudoNode = PseudoNode> {
  public readonly node: T;
  public readonly pathPart: T extends Document ? undefined : PathPart;

  public constructor(node: T extends Document ? Document : never);
  public constructor(node: T, pathPart: PathPart);
  constructor(node: T, pathPart?: PathPart) {
    this.node = node;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    this.pathPart = pathPart as any;
  }
}
