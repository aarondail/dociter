import lodash from "lodash";

import { FancyText, Text } from "../text-model-rd4";

import { Facet, FacetMap, FacetType } from "./facets";

export enum NodeCategory {
  Block = "BLOCK",
  Inline = "INLINE",
  Annotation = "ANNOTATION",
  Lateral = "LATERAL",
  SuperBlock = "SUPER_BLOCK",
  Intermediate = "INTERMEDIATE",
}

export enum NodeChildrenType {
  None = "NONE",
  Text = "TEXT",
  FancyText = "FANCY_TEXT",
  Inlines = "INLINES",
  Blocks = "BLOCKS",
  Intermediates = "INTERMEDIATES",
  BlocksAndSuperBlocks = "BLOCKS_AND_SUPER_BLOCKS",
}

export class NodeType {
  public constructor(
    public readonly nodeName: string,
    public readonly category: NodeCategory,
    public readonly childrenType: NodeChildrenType,
    public readonly facets: FacetMap,
    public readonly specificIntermediateChildType?: NodeType
  ) {
    // eslint-disable @typescript-eslint/unbound-method
    this.getFacetsThatAreAnchors = lodash.once(this.getFacetsThatAreAnchors);
    this.getFacetsThatAreNodeArrays = lodash.once(this.getFacetsThatAreNodeArrays);
    this.hasGraphemeChildren = lodash.once(this.hasGraphemeChildren);
    this.hasNodeChildren = lodash.once(this.hasNodeChildren);
    // eslint-enable @typescript-eslint/unbound-method
  }

  // facetsWithIndividualNodes: lodash.memoize((nodeType: NodeType) => {
  //   const result: Facet = [];
  //   for (const facet of nodeType.facets) {
  //     switch (
  //       facet.type
  //       // case FacetType.NodeArray:
  //       //   result.push(facet);
  //     ) {
  //     }
  //   }
  //   return result;
  // }),

  public getFacetsThatAreAnchors = (): Facet[] => {
    const result: Facet[] = [];
    for (const facet of this.facets) {
      switch (facet.type) {
        case FacetType.Anchor:
        case FacetType.AnchorOrAnchorRange:
        case FacetType.AnchorRange:
          result.push(facet);
      }
    }
    return result;
  };

  public getFacetsThatAreNodeArrays = (): Facet[] => {
    const result: Facet[] = [];
    for (const facet of this.facets) {
      switch (facet.type) {
        case FacetType.NodeArray:
          result.push(facet);
      }
    }
    return result;
  };

  public hasGraphemeChildren = (): boolean => {
    switch (this.childrenType) {
      case NodeChildrenType.FancyText:
      case NodeChildrenType.Text:
        return true;
      default:
        return true;
    }
  };

  public hasNodeChildren = (): boolean => {
    switch (this.childrenType) {
      case NodeChildrenType.FancyText:
      case NodeChildrenType.Text:
      case NodeChildrenType.None:
        return false;
      default:
        return true;
    }
  };
}

export abstract class Node {
  public abstract children?: readonly Node[] | Text | FancyText;
  public abstract nodeType: NodeType;
}
