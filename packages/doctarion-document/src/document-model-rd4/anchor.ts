import { Node } from "./node";

/**
 * Anchors can be placed on nodes, but also before and after them. Before and
 * after meaning between this node and its preceding sibling (if any), or after
 * this node and its following sibling.
 */
export enum AnchorOrientation {
  Before = "BEFORE",
  After = "AFTER",
  On = "ON",
}

export class Anchor {
  public constructor(
    public readonly node: Node,
    public readonly orientation: AnchorOrientation,
    public readonly textContentIndex?: number
  ) {}
}

export class AnchorRange {
  public constructor(public readonly anterior: Anchor, public readonly posterior: Anchor) {}
}
