import { immerable } from "immer";

import { SimpleComparison } from "../miscUtils";
import { Node, NodeUtils } from "../models";

export class PathPart {
  [immerable] = true;

  public constructor(readonly index: number) {}

  public adjustIndex(offset: number): PathPart {
    return new PathPart(this.index + offset);
  }

  public compareTo(other: PathPart): SimpleComparison {
    if (this.index === other.index) {
      return SimpleComparison.Equal;
    } else if (this.index < other.index) {
      return SimpleComparison.Before;
    }
    return SimpleComparison.After;
  }

  public equalTo(other: PathPart): boolean {
    return this.index === other.index;
  }

  public resolve(node: Node): Node | undefined {
    return NodeUtils.getChildren(node)?.[this.index];
  }

  public setIndex(index: number): PathPart {
    return new PathPart(index);
  }

  public toString(): string {
    return this.index.toString();
  }
}
