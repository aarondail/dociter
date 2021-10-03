import { NodeCategory, NodeType } from "./node";

export class FacetMap implements Iterable<Facet> {
  public static readonly empty = new FacetMap();

  private readonly facets: ReadonlyMap<string, Facet>;

  public constructor(...facets: Facet[]) {
    this.facets = new Map(facets.map((f) => [f.name, f]));
  }

  public [Symbol.iterator](): Iterator<Facet> {
    return this.facets.values();
  }

  public extend(other: FacetMap): FacetMap {
    return new FacetMap(...[...other.facets.values(), ...this.facets.values()]);
  }

  public get(name: string): Facet | undefined {
    return this.facets.get(name);
  }
}

export enum FacetType {
  Anchor,
  AnchorRange,
  AnchorOrAnchorRange,
  Boolean,
  Enum,
  EntityId,
  NodeArray,
  Text,
  TextStyleStrip,
}

export class Facet {
  public constructor(
    public readonly type: FacetType,
    public readonly name: string,
    public readonly optional: boolean,
    public readonly options?: readonly string[],
    public readonly nodeCategory?: NodeCategory
  ) {}

  public canContainNodesOfType = (nodeType: NodeType): boolean => {
    if (this.type !== FacetType.NodeArray) {
      return false;
    }
    if (this.nodeCategory === undefined) {
      return true;
    }
    return this.nodeCategory === nodeType.category;
  };

  public static anchor(name: string, optional = false): Facet {
    return new Facet(FacetType.Anchor, name, optional);
  }
  public static anchorOrAnchorRange(name: string, optional = false): Facet {
    return new Facet(FacetType.AnchorOrAnchorRange, name, optional);
  }
  public static anchorRange(name: string, optional = false): Facet {
    return new Facet(FacetType.AnchorRange, name, optional);
  }
  public static boolean(name: string, optional = false): Facet {
    return new Facet(FacetType.Boolean, name, optional);
  }
  public static entityId(name: string, optional = false): Facet {
    return new Facet(FacetType.EntityId, name, optional);
  }
  public static enum(name: string, options: string[], optional = false): Facet {
    return new Facet(FacetType.Enum, name, optional, options);
  }
  public static nodeArray(name: string, nodeCategory: NodeCategory, optional = false): Facet {
    return new Facet(FacetType.NodeArray, name, optional, undefined, nodeCategory);
  }
  public static text(name: string, optional = false): Facet {
    return new Facet(FacetType.Text, name, optional);
  }
  public static textStyleStrip(name: string, optional = false): Facet {
    return new Facet(FacetType.TextStyleStrip, name, optional);
  }
}
