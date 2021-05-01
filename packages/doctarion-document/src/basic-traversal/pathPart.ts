import { Node, NodeUtils } from "../models";

export class PathPart {
  public constructor(readonly index: number) {}

  public equalTo(other: PathPart): boolean {
    return this.index === other.index;
  }

  public modifyIndex(offset: number): PathPart {
    return new PathPart(this.index + offset);
  }

  public resolve(node: Node): Node | undefined {
    return NodeUtils.getChildren(node)?.[this.index];
  }

  public toString(): string {
    return this.index.toString();
  }
}
