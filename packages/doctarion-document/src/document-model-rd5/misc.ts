import { Node } from "./node";
import { NodeType } from "./nodeType";

export enum FloaterPlacement {
  Above = "ABOVE",
  Below = "BELOW",
}

export enum HeaderLevel {
  One = "ONE",
  Two = "TWO",
  Three = "THREE",
}

export type NodeOfType<T extends NodeType> = Node<T extends NodeType<infer X> ? X : never>;
