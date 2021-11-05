import {
  Document,
  FacetType,
  FacetTypeConvenienceDictionary,
  FacetValueType,
  Node,
  NodeChildrenType,
  NodeType,
  NodeTypeDescription,
} from "../document-model-rd5";
import { Intersection, Matching, NonMatching, OptionValueTypeFromOptionArray } from "../miscUtils";
import { FancyGrapheme, FancyText, Grapheme, Text } from "../text-model-rd4";
import { PathPart } from "../traversal-rd4";

import { AnchorId, ReadonlyWorkingAnchor, WorkingAnchor, WorkingAnchorRange } from "./anchor";
import { WorkingTextStyleStrip } from "./textStyleStrip";

export type NodeId = string;

export class WorkingNode<
  SpecificNodeTypeDescription extends NodeTypeDescription = NodeTypeDescription
> extends Node<SpecificNodeTypeDescription> {
  public attachedAnchors: Map<AnchorId, WorkingAnchor>;
  declare children: NodeChildrenTypeToActualTypeForWorkingNode<SpecificNodeTypeDescription["childrenType"]>;
  declare facets: SpecificNodeTypeDescription["facets"] extends FacetTypeConvenienceDictionary
    ? FacetDictionaryForWorkingNode<SpecificNodeTypeDescription["facets"]>
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

type FacetValueTypeToActualTypeForWorkingNode<T extends FacetValueType> = T extends FacetValueType.Anchor
  ? WorkingAnchor
  : T extends FacetValueType.AnchorOrAnchorRange
  ? WorkingAnchor | WorkingAnchorRange
  : T extends FacetValueType.AnchorRange
  ? WorkingAnchorRange
  : T extends FacetValueType.Boolean
  ? boolean
  : T extends FacetValueType.EntityId
  ? string
  : T extends FacetValueType.Enum
  ? string
  : T extends FacetValueType.NodeArray
  ? WorkingNode[]
  : T extends FacetValueType.String
  ? string
  : T extends FacetValueType.TextStyleStrip
  ? WorkingTextStyleStrip
  : never;

// Regarding the NodeArray facet, we could try to give that a more specific type
// but it seems pretty complicated... and anyways we don't do that for children
// (and it'd) be hard to handle `specificIntermediateChildType` for the case of
// intermediates).

type FacetTypeToActualTypePrimeForWorkingNode<T extends FacetType> = T["valueType"] extends FacetValueType.Enum
  ? T["options"] extends readonly string[]
    ? OptionValueTypeFromOptionArray<T["options"]>
    : never
  : FacetValueTypeToActualTypeForWorkingNode<T["valueType"]>;

type FacetTypeToActualTypeForWorkingNode<T extends FacetType> = T["optional"] extends true
  ? FacetTypeToActualTypePrimeForWorkingNode<T> | undefined
  : FacetTypeToActualTypePrimeForWorkingNode<T>;

// This is what we want (dictionary of facet names to actual types) EXCEPT that
// the optional ones aren't marked truly optional (with a ?). We need the
// following type to make that work.
type FacetDictionaryForWorkingNodePrimeNonOptional<T extends FacetTypeConvenienceDictionary> = {
  [property in keyof T]: T[property] extends FacetValueType
    ? FacetValueTypeToActualTypeForWorkingNode<T[property]>
    : T[property] extends FacetType
    ? FacetTypeToActualTypeForWorkingNode<T[property]>
    : never;
};

/**
 * Mapped type that takes a dictionary type describing facets (i.e., passed to
 * NodeType when it is constructed) and returns a d dictionary type of facet
 * names to facet actual types for a WorkingNode.
 */
// This complicated type is the same as FacetDictionaryForWorkingNodePrimeNonOptional but with
// the properties marked as optional actually optional.
//
// Got this technique from:
// https://stackoverflow.com/questions/67552360/conditionally-apply-modifier-in-mapped-type-per-property
// eslint-disable-next-line @typescript-eslint/ban-types
export type FacetDictionaryForWorkingNode<T extends FacetTypeConvenienceDictionary = {}> = Intersection<
  Partial<Pick<FacetDictionaryForWorkingNodePrimeNonOptional<T>, Matching<T, { optional: true }>>>,
  Required<Pick<FacetDictionaryForWorkingNodePrimeNonOptional<T>, NonMatching<T, { optional: true }>>>
>;

export type WorkingNodeOfType<T extends NodeType> = WorkingNode<T extends NodeType<infer X> ? X : never>;

export type WorkingDocumentNode = WorkingNodeOfType<typeof Document>;

type NodeChildrenTypeToActualTypeForReadonlyWorkingNode<T extends NodeChildrenType> = T extends NodeChildrenType.None
  ? []
  : T extends NodeChildrenType.FancyText
  ? FancyText
  : T extends NodeChildrenType.Text
  ? Text
  : readonly ReadonlyWorkingNode[];

export interface ReadonlyWorkingNode<SpecificNodeTypeDescription extends NodeTypeDescription = NodeTypeDescription>
  extends Node<SpecificNodeTypeDescription> {
  readonly attachedAnchors: ReadonlyMap<AnchorId, ReadonlyWorkingAnchor>;
  readonly children: NodeChildrenTypeToActualTypeForReadonlyWorkingNode<SpecificNodeTypeDescription["childrenType"]>;
  // eslint-disable-next-line @typescript-eslint/ban-types
  // readonly facets: {}; This should be mapped probably to appropriate working types, but as of yet I am unsure if we need it
  readonly id: NodeId;
  readonly parent?: ReadonlyWorkingNode;
  readonly pathPartFromParent?: PathPart;
}

type ExtractDescriptionFromNodeType<T> = T extends NodeType<infer X> ? X : never;

export type ReadonlyWorkingDocumentNode = ReadonlyWorkingNode<ExtractDescriptionFromNodeType<typeof Document>>;
