import { NodeType } from "./node";

export class FacetMap {
  public static readonly empty = new FacetMap();

  private readonly facets: Facet[];

  public constructor(...facets: Facet[]) {
    this.facets = facets;
  }

  public static extend(original: FacetMap, ...newFacets: Facet[]): FacetMap {
    const oldFacets = original.facets;
    return new FacetMap(...[...oldFacets, ...newFacets]);
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
  | { readonly name: string; readonly type: FacetType.NodeArray; readonly nodeType: Partial<NodeType> }
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
  nodeArray(name: string, nodeType: Partial<NodeType>): Facet {
    return { name, type: FacetType.NodeArray, nodeType };
  },
  string(name: string): Facet {
    return { name, type: FacetType.String };
  },
};
