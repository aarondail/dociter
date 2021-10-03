import lodash from "lodash";

import { FancyText, Text } from "../text-model-rd4";

import { Anchor, AnchorRange } from "./anchor";
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
    this.canContainChildrenOfType = lodash.once(this.canContainChildrenOfType);
    this.getFacetsThatAreAnchors = lodash.once(this.getFacetsThatAreAnchors);
    this.getFacetsThatAreNodeArrays = lodash.once(this.getFacetsThatAreNodeArrays);
    this.hasGraphemeChildren = lodash.once(this.hasGraphemeChildren);
    this.hasNodeChildren = lodash.once(this.hasNodeChildren);
    // eslint-enable @typescript-eslint/unbound-method
  }

  public canContainChildrenOfType = (nodeType: NodeType): boolean => {
    switch (this.childrenType) {
      case NodeChildrenType.Inlines:
        return nodeType.category === NodeCategory.Inline;
      case NodeChildrenType.Blocks:
        return nodeType.category === NodeCategory.Block;
      case NodeChildrenType.BlocksAndSuperBlocks:
        return nodeType.category === NodeCategory.Block || nodeType.category === NodeCategory.SuperBlock;
      case NodeChildrenType.Intermediates:
        return (
          nodeType.category === NodeCategory.Intermediate &&
          (this.specificIntermediateChildType === undefined || this.specificIntermediateChildType === nodeType)
        );
    }
    return false;
  };

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

  getAllFacetAnchors(): readonly [Facet, Anchor | AnchorRange][] {
    const result: [Facet, Anchor | AnchorRange][] = [];
    for (const facet of this.nodeType.getFacetsThatAreAnchors()) {
      const value = this.getFacetValue(facet) as Anchor | AnchorRange;
      if (value) {
        result.push([facet, value]);
      }
    }
    return result;
  }

  getAllFacetNodes(): readonly [Facet, readonly Node[]][] {
    const result: [Facet, readonly Node[]][] = [];
    for (const facet of this.nodeType.getFacetsThatAreNodeArrays()) {
      const array = this.getFacetValue(facet) as readonly Node[];
      if (array) {
        result.push([facet, array]);
      }
    }
    return result;
  }

  getFacetValue(facet: Facet): unknown | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    return (this as any)[facet.name];
  }
}
