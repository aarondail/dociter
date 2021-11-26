import { Node } from "../document-model";
import { SimpleComparison } from "../miscUtils";

import { PseudoNode } from "./pseudoNode";

export class PathPart {
  public readonly facet?: string;
  public readonly index?: number;

  public constructor(index: number);
  public constructor(facet: string);
  public constructor(facet: string, index: number);
  public constructor(arg1: number | string, arg2?: number) {
    if (typeof arg1 === "string") {
      this.facet = arg1;
      this.index = arg2;
    } else {
      this.index = arg1;
    }
  }

  public adjustIndex(offset: number): PathPart {
    if (this.facet) {
      return new PathPart(this.facet, this.index! + offset);
    }
    return new PathPart(this.index! + offset);
  }

  public compareTo(other: PathPart): SimpleComparison {
    if (this.facet !== other.facet) {
      return SimpleComparison.Incomparable;
    } else if (this.index === other.index) {
      return SimpleComparison.Equal;
    } else if (this.index! < other.index!) {
      return SimpleComparison.Before;
    }
    return SimpleComparison.After;
  }

  public equalTo(other: PathPart): boolean {
    return this.index === other.index && this.facet === other.index;
  }

  public resolve<NodeClass extends Node>(from: PseudoNode<NodeClass>): PseudoNode<NodeClass> | undefined {
    if (!(from instanceof Node)) {
      return undefined;
    }
    if (this.facet) {
      const facet = from.getFacet(this.facet) as any;
      if (facet && this.index !== undefined) {
        return facet[this.index];
      }
      return facet;
    } else {
      return from.children?.[this.index!] as NodeClass;
    }
  }

  public setIndex(index: number): PathPart {
    if (this.facet) {
      return new PathPart(this.facet, index);
    }
    return new PathPart(index);
  }

  public toString(): string {
    if (this.facet !== undefined) {
      if (this.index !== undefined) {
        return `${this.facet}:${this.index}`;
      }
      return `${this.facet}`;
    } else {
      return this.index!.toString();
    }
  }
}
