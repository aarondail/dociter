import { FancyText, Text, TextStyleStrip } from "../text-model";

import { Anchor, AnchorRange } from "./anchor";
import { FacetDictionary, FacetTypeConvenienceDictionary, FacetTypeWithName } from "./facets";
import { NodeChildrenType, NodeType, NodeTypeDescription } from "./nodeType";

type NodeChildrenTypeToActualType<T extends NodeChildrenType> = T extends NodeChildrenType.None
  ? []
  : T extends NodeChildrenType.FancyText
  ? FancyText
  : T extends NodeChildrenType.Text
  ? Text
  : readonly Node[];

export class Node<SpecificNodeTypeDescription extends NodeTypeDescription = NodeTypeDescription> {
  public constructor(
    public readonly nodeType: NodeType<SpecificNodeTypeDescription>,
    public readonly children: NodeChildrenTypeToActualType<SpecificNodeTypeDescription["childrenType"]>,
    public readonly facets: SpecificNodeTypeDescription["facets"] extends FacetTypeConvenienceDictionary
      ? FacetDictionary<SpecificNodeTypeDescription["facets"]>
      : // eslint-disable-next-line @typescript-eslint/ban-types
        {}
  ) {}

  getAllFacetAnchors(): readonly [FacetTypeWithName, Anchor | AnchorRange][] {
    const result: [FacetTypeWithName, Anchor | AnchorRange][] = [];
    for (const f of this.nodeType.getFacetsThatAreAnchors()) {
      const value = this.getFacet(f.name) as Anchor | AnchorRange;
      if (value) {
        result.push([f, value]);
      }
    }
    return result;
  }

  getAllFacetNodes(): readonly [FacetTypeWithName, readonly Node[]][] {
    const result: [FacetTypeWithName, readonly Node[]][] = [];
    for (const f of this.nodeType.getFacetsThatAreNodeArrays()) {
      const array = this.getFacet(f.name) as readonly Node[];
      if (array) {
        result.push([f, array]);
      }
    }
    return result;
  }

  /**
   * This is a convenience function for typescript since `facets` often tye type
   * `{}`. This is the same as doing `node.facets[facetName]`.
   */
  getFacet(facetName: string): unknown | undefined {
    return (this.facets as any)[facetName];
  }

  getTextStyleStripFacet(): [FacetTypeWithName, TextStyleStrip | undefined] | undefined {
    const f = this.nodeType.getTextStyleStripFacet();
    if (f) {
      return [f, this.getFacet(f.name) as TextStyleStrip];
    }
    return undefined;
  }
}
