import { OptionValueTypeFromOptionArray } from "../miscUtils";
import { TextStyleStrip } from "../text-model-rd4";

import { Anchor, AnchorRange } from "./anchor";
import { Node } from "./node";
import { NodeCategory } from "./nodeType";

export enum FacetType {
  Anchor,
  AnchorRange,
  AnchorOrAnchorRange,
  Boolean,
  Enum,
  EntityId,
  NodeArray,
  String,
  TextStyleStrip,
}

export interface Facet {
  readonly optional?: boolean;
  readonly options?: readonly string[];
  readonly type: FacetType;
  readonly nodeCategory?: NodeCategory;
}

export type FacetConvenienceDictionary = { readonly [name: string]: FacetType | Facet };

export type FacetDictionary = { readonly [name: string]: Facet };

type FacetTypeToActualType<T extends FacetType> = T extends FacetType.Anchor
  ? Anchor
  : T extends FacetType.AnchorOrAnchorRange
  ? Anchor | AnchorRange
  : T extends FacetType.AnchorRange
  ? AnchorRange
  : T extends FacetType.Boolean
  ? boolean
  : T extends FacetType.EntityId
  ? string
  : T extends FacetType.Enum
  ? string
  : T extends FacetType.NodeArray
  ? readonly Node[]
  : T extends FacetType.String
  ? string
  : T extends FacetType.TextStyleStrip
  ? TextStyleStrip
  : never;

// Regarding the NodeArray facet, we could try to give that a more specific type
// but it seems pretty complicated... and anyways we don't do that for children
// (and it'd) be hard to handle `specificIntermediateChildType` for the case of
// intermediates).

type FacetToActualTypePrime<T extends Facet> = T["type"] extends FacetType.Enum
  ? T["options"] extends readonly string[]
    ? OptionValueTypeFromOptionArray<T["options"]>
    : never
  : FacetTypeToActualType<T["type"]>;

type FacetToActualType<T extends Facet> = T["optional"] extends true
  ? FacetToActualTypePrime<T> | undefined
  : FacetToActualTypePrime<T>;

export type FacetActualTypeDictionary<T extends FacetConvenienceDictionary> = {
  [property in keyof T]: T[property] extends FacetType
    ? FacetTypeToActualType<T[property]>
    : T[property] extends Facet
    ? FacetToActualType<T[property]>
    : never;
};

export type FacetWithName = { readonly name: string; readonly facet: Facet };
