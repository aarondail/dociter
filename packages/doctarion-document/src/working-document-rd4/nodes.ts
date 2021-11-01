import {
  Document,
  Facet,
  FacetConvenienceDictionary,
  FacetType,
  Node,
  NodeChildrenType,
  NodeType,
  NodeTypeDescription,
} from "../document-model-rd5";
import { OptionValueTypeFromOptionArray } from "../miscUtils";
import { FancyGrapheme, FancyText, Grapheme, Text } from "../text-model-rd4";
import { PathPart } from "../traversal-rd4";

import { AnchorId, ReadonlyWorkingAnchor, WorkingAnchor, WorkingAnchorRange } from "./anchor";
import { WorkingTextStyleStrip } from "./textStyleStrip";

export type NodeId = string;

// I'm unsure (even though I have done it) if it makes any sense to make this
// class generic, and provide the mapped types so that the children and facets
// are more specific.

export class WorkingNode<
  SpecificNodeTypeDescription extends NodeTypeDescription = NodeTypeDescription
> extends Node<SpecificNodeTypeDescription> {
  public attachedAnchors: Map<AnchorId, WorkingAnchor>;
  declare children: NodeChildrenTypeToActualTypeForWorkingNode<SpecificNodeTypeDescription["childrenType"]>;
  declare facets: SpecificNodeTypeDescription["facets"] extends FacetConvenienceDictionary
    ? FacetActualTypeDictionaryForWorkingNode<SpecificNodeTypeDescription["facets"]>
    : // eslint-disable-next-line @typescript-eslint/ban-types
      {};
  declare nodeType: NodeType<SpecificNodeTypeDescription>;
  public parent?: WorkingNode;
  public pathPartFromParent?: PathPart;

  public constructor(nodeType: NodeType<SpecificNodeTypeDescription>, public id: NodeId) {
    // Force facets to be empty, even thought that may not adhere with the
    // passed NodeType. WorkingNode creation should go through
    // `createWorkingNode` which will properly setup the facets after the node
    // is constructed.
    super(nodeType, [], {} as any);

    this.attachedAnchors = new Map();
  }

  /**
   * This is a convenience function for typescript since `facets` often tye type
   * `{}`. This is the same as doing `node.facets[facetName] = value`.
   */
  public setFacet(facetName: string, value: unknown): void {
    (this.facets as any)[facetName] = value;
  }
}

type NodeChildrenTypeToActualTypeForWorkingNode<T extends NodeChildrenType> = T extends NodeChildrenType.None
  ? []
  : T extends NodeChildrenType.FancyText
  ? FancyGrapheme[]
  : T extends NodeChildrenType.Text
  ? Grapheme[]
  : WorkingNode[];

type FacetTypeToActualTypeForWorkingNode<T extends FacetType> = T extends FacetType.Anchor
  ? WorkingAnchor
  : T extends FacetType.AnchorOrAnchorRange
  ? WorkingAnchor | WorkingAnchorRange
  : T extends FacetType.AnchorRange
  ? WorkingAnchorRange
  : T extends FacetType.Boolean
  ? boolean
  : T extends FacetType.EntityId
  ? string
  : T extends FacetType.Enum
  ? string
  : T extends FacetType.NodeArray
  ? WorkingNode[]
  : T extends FacetType.String
  ? string
  : T extends FacetType.TextStyleStrip
  ? WorkingTextStyleStrip
  : never;

// Regarding the NodeArray facet, we could try to give that a more specific type
// but it seems pretty complicated... and anyways we don't do that for children
// (and it'd) be hard to handle `specificIntermediateChildType` for the case of
// intermediates).

type FacetToActualTypePrimeForWorkingNode<T extends Facet> = T["type"] extends FacetType.Enum
  ? T["options"] extends readonly string[]
    ? OptionValueTypeFromOptionArray<T["options"]>
    : never
  : FacetTypeToActualTypeForWorkingNode<T["type"]>;

type FacetToActualTypeForWorkingNode<T extends Facet> = T["optional"] extends true
  ? FacetToActualTypePrimeForWorkingNode<T> | undefined
  : FacetToActualTypePrimeForWorkingNode<T>;

type FacetActualTypeDictionaryForWorkingNode<T extends FacetConvenienceDictionary> = {
  [property in keyof T]: T[property] extends FacetType
    ? FacetTypeToActualTypeForWorkingNode<T[property]>
    : T[property] extends Facet
    ? FacetToActualTypeForWorkingNode<T[property]>
    : never;
};

type WorkingNodeOfType<T extends NodeType> = WorkingNode<T extends NodeType<infer X> ? X : never>;

export type WorkingDocumentNode = WorkingNodeOfType<typeof Document>;

type NodeChildrenTypeToActualTypeForReadonlyWorkingNode<T extends NodeChildrenType> = T extends NodeChildrenType.None
  ? []
  : T extends NodeChildrenType.FancyText
  ? FancyText
  : T extends NodeChildrenType.Text
  ? Text
  : readonly Node[];

export interface ReadonlyWorkingNode<SpecificNodeTypeDescription extends NodeTypeDescription = NodeTypeDescription>
  extends Node<SpecificNodeTypeDescription> {
  readonly attachedAnchors: ReadonlyMap<AnchorId, ReadonlyWorkingAnchor>;
  readonly children: NodeChildrenTypeToActualTypeForReadonlyWorkingNode<SpecificNodeTypeDescription["childrenType"]>;
  // eslint-disable-next-line @typescript-eslint/ban-types
  // readonly facets: {}; This should be mapped probably to appropriate working types
  readonly id: NodeId;
  readonly parent?: ReadonlyWorkingNode;
  readonly pathPartFromParent?: PathPart;
}

type ExtractDescriptionFromNodeType<T> = T extends NodeType<infer X> ? X : never;

export type ReadonlyWorkingDocumentNode = ReadonlyWorkingNode<ExtractDescriptionFromNodeType<typeof Document>>;
