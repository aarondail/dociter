import { Document, Node } from "../document-model";

import { PathPart } from "./pathPart";

export class ChainLink<T extends Node = Node> {
  public readonly node: T;
  public readonly pathPart: T extends Document ? undefined : PathPart;

  public constructor(node: T, ...args: T extends Document ? [] : [PathPart]) {
    this.node = node;
    this.pathPart = args[0] as any;
  }
}
