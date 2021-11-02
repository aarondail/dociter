import lodash from "lodash";

import { FacetConvenienceDictionary, FacetDictionary, FacetType, FacetWithName } from "./facets";

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
  // Only Inline nodes (see NodeCategory) should ever contain Text
  Text = "TEXT",
  // Only Inline nodes (see NodeCategory) should ever contain FancyText
  FancyText = "FANCY_TEXT",
  // Only Block nodes (see NodeCategory) should ever contain Inlines
  Inlines = "INLINES",
  // Only Super Blocks and Intermediate nodes (see NodeCategory) should ever contain Blocks
  Blocks = "BLOCKS",
  // Intermediates should always be in a (corresponding, specific) Super Block
  Intermediates = "INTERMEDIATES",
  BlocksAndSuperBlocks = "BLOCKS_AND_SUPER_BLOCKS",
}

export interface NodeTypeDescription {
  readonly name: string;
  readonly category: NodeCategory;
  readonly childrenType: NodeChildrenType;
  readonly facets?: FacetConvenienceDictionary;
  readonly specificIntermediateChildType?: NodeTypeDescription;
}

export class NodeType<SpecificNodeTypeDescription extends NodeTypeDescription = NodeTypeDescription> {
  public readonly category!: NodeCategory;
  public readonly childrenType!: NodeChildrenType;
  public readonly facets?: FacetDictionary;
  public readonly name!: string;
  public readonly specificIntermediateChildType?: NodeType;

  public constructor(description: SpecificNodeTypeDescription) {
    Object.assign(this, description);
    this.facets = (description.facets
      ? lodash.mapValues(description.facets, (v) => (FacetType[v as any] ? { type: v } : v))
      : undefined) as any;

    // eslint-disable @typescript-eslint/unbound-method
    this.getFacetsThatAreAnchors = lodash.once(this.getFacetsThatAreAnchors);
    this.getFacetsThatAreNodeArrays = lodash.once(this.getFacetsThatAreNodeArrays);
    this.getFacetsThatAreTextStyleStrips = lodash.once(this.getFacetsThatAreTextStyleStrips);
    // eslint-enable @typescript-eslint/unbound-method
  }

  public getFacetsThatAreAnchors = (): FacetWithName[] => {
    if (!this.facets) {
      return [];
    }
    const result: FacetWithName[] = [];
    for (const [name, facet] of Object.entries(this.facets)) {
      switch (facet.type) {
        case FacetType.Anchor:
        case FacetType.AnchorOrAnchorRange:
        case FacetType.AnchorRange:
          result.push({ name, facet });
      }
    }
    return result;
  };

  public getFacetsThatAreNodeArrays = (): FacetWithName[] => {
    if (!this.facets) {
      return [];
    }
    const result: FacetWithName[] = [];
    for (const [name, facet] of Object.entries(this.facets)) {
      switch (facet.type) {
        case FacetType.NodeArray:
          result.push({ name, facet });
      }
    }
    return result;
  };

  public getFacetsThatAreTextStyleStrips = (): FacetWithName[] => {
    if (!this.facets) {
      return [];
    }
    const result: FacetWithName[] = [];
    for (const [name, facet] of Object.entries(this.facets)) {
      switch (facet.type) {
        case FacetType.TextStyleStrip:
          result.push({ name, facet });
      }
    }
    return result;
  };
}
