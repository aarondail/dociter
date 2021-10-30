import { FancyText, TextStyleStrip } from "../text-model-rd4";

import { Anchor, AnchorRange } from "./anchor";
import { FacetActualTypeDictionary, FacetWithName } from "./facets";
import { NodeType, NodeTypeDescription } from "./nodeType";

export class Node<SpecificNodeTypeDescription extends NodeTypeDescription = NodeTypeDescription> {
  public constructor(
    public readonly nodeType: NodeType<SpecificNodeTypeDescription>,
    public readonly children: readonly Node[] | Text | FancyText | undefined,
    public readonly facets: SpecificNodeTypeDescription["facets"] extends NodeTypeDescription
      ? FacetActualTypeDictionary<SpecificNodeTypeDescription["facets"]>
      : // eslint-disable-next-line @typescript-eslint/ban-types
        undefined | {}
  ) {}

  getAllFacetAnchors(): readonly [FacetWithName, Anchor | AnchorRange][] {
    const result: [FacetWithName, Anchor | AnchorRange][] = [];
    for (const f of this.nodeType.getFacetsThatAreAnchors()) {
      const value = this.getFacet(f.name) as Anchor | AnchorRange;
      if (value) {
        result.push([f, value]);
      }
    }
    return result;
  }

  getAllFacetNodes(): readonly [FacetWithName, readonly Node[]][] {
    const result: [FacetWithName, readonly Node[]][] = [];
    for (const f of this.nodeType.getFacetsThatAreNodeArrays()) {
      const array = this.getFacet(f.name) as readonly Node[];
      if (array) {
        result.push([f, array]);
      }
    }
    return result;
  }

  getAllFacetTextStyleStrips(): readonly [FacetWithName, TextStyleStrip][] {
    const result: [FacetWithName, TextStyleStrip][] = [];
    for (const f of this.nodeType.getFacetsThatAreTextStyleStrips()) {
      const value = this.getFacet(f.name) as TextStyleStrip;
      if (value) {
        result.push([f, value]);
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
}
