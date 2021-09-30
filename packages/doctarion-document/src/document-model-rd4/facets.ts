import { NodeCategory } from ".";

export class FacetMap implements Iterable<Facet> {
  public static readonly empty = new FacetMap();

  private readonly facets: Facet[];

  public constructor(...facets: Facet[]) {
    this.facets = facets;
  }

  public [Symbol.iterator](): Iterator<Facet> {
    return this.facets[Symbol.iterator]();
  }

  public extend(other: FacetMap): FacetMap {
    return new FacetMap(...[...other.facets, ...this.facets]);
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

export type Facet =
  | { readonly name: string; readonly type: FacetType.Anchor }
  | { readonly name: string; readonly type: FacetType.AnchorRange }
  | { readonly name: string; readonly type: FacetType.AnchorOrAnchorRange }
  | { readonly name: string; readonly type: FacetType.Boolean }
  | { readonly name: string; readonly type: FacetType.Enum; readonly options: string[] }
  | { readonly name: string; readonly type: FacetType.EntityId }
  | { readonly name: string; readonly type: FacetType.NodeArray; readonly nodeCategory: NodeCategory }
  | { readonly name: string; readonly type: FacetType.String };

export const Facet = {
  anchor(name: string): Facet {
    return { name, type: FacetType.Anchor };
  },
  anchorRange(name: string): Facet {
    return { name, type: FacetType.AnchorRange };
  },
  anchorOrAnchorRange(name: string): Facet {
    return { name, type: FacetType.AnchorOrAnchorRange };
  },
  boolean(name: string): Facet {
    return { name, type: FacetType.Boolean };
  },
  enum(name: string, options: string[]): Facet {
    return { name, type: FacetType.Enum, options };
  },
  entityId(name: string): Facet {
    return { name, type: FacetType.EntityId };
  },
  nodeArray(name: string, nodeCategory: NodeCategory): Facet {
    return { name, type: FacetType.NodeArray, nodeCategory };
  },
  string(name: string): Facet {
    return { name, type: FacetType.String };
  },
};
