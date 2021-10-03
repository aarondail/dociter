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
  String,
}

export class Facet {
  public constructor(
    public readonly type: FacetType,
    public readonly name: string,
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

  public static anchor(name: string): Facet {
    return new Facet(FacetType.Anchor, name);
  }
  public static anchorOrAnchorRange(name: string): Facet {
    return new Facet(FacetType.AnchorOrAnchorRange, name);
  }
  public static anchorRange(name: string): Facet {
    return new Facet(FacetType.AnchorRange, name);
  }
  public static boolean(name: string): Facet {
    return new Facet(FacetType.Boolean, name);
  }
  public static entityId(name: string): Facet {
    return new Facet(FacetType.EntityId, name);
  }
  public static enum(name: string, options: string[]): Facet {
    return new Facet(FacetType.Enum, name, options);
  }
  public static nodeArray(name: string, nodeCategory: NodeCategory): Facet {
    return new Facet(FacetType.NodeArray, name, undefined, nodeCategory);
  }
  public static string(name: string): Facet {
    return new Facet(FacetType.String, name);
  }
}
