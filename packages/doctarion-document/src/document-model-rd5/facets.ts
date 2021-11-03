import { OptionValueTypeFromOptionArray } from "../miscUtils";
import { TextStyleStrip } from "../text-model-rd4";

import { Anchor, AnchorRange } from "./anchor";
import { Node } from "./node";
import { NodeCategory } from "./nodeType";

export enum FacetValueType {
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

export interface FacetType {
  readonly optional?: boolean;
  readonly options?: readonly string[];
  readonly valueType: FacetValueType;
  readonly nodeCategory?: NodeCategory;
}

export type FacetTypeConvenienceDictionary = { readonly [name: string]: FacetValueType | FacetType };

export type FacetTypeDictionary = { readonly [name: string]: FacetType };

type FacetValueTypeToActualType<T extends FacetValueType> = T extends FacetValueType.Anchor
  ? Anchor
  : T extends FacetValueType.AnchorOrAnchorRange
  ? Anchor | AnchorRange
  : T extends FacetValueType.AnchorRange
  ? AnchorRange
  : T extends FacetValueType.Boolean
  ? boolean
  : T extends FacetValueType.EntityId
  ? string
  : T extends FacetValueType.Enum
  ? string
  : T extends FacetValueType.NodeArray
  ? readonly Node[]
  : T extends FacetValueType.String
  ? string
  : T extends FacetValueType.TextStyleStrip
  ? TextStyleStrip
  : never;

// Regarding the NodeArray facet, we could try to give that a more specific type
// but it seems pretty complicated... and anyways we don't do that for children
// (and it'd) be hard to handle `specificIntermediateChildType` for the case of
// intermediates).

type FacetTypeToActualTypePrime<T extends FacetType> = T["valueType"] extends FacetValueType.Enum
  ? T["options"] extends readonly string[]
    ? OptionValueTypeFromOptionArray<T["options"]>
    : never
  : FacetValueTypeToActualType<T["valueType"]>;

type FacetTypeToActualType<T extends FacetType> = T["optional"] extends true
  ? FacetTypeToActualTypePrime<T> | undefined
  : FacetTypeToActualTypePrime<T>;

// eslint-disable-next-line @typescript-eslint/ban-types
export type FacetDictionary<T extends FacetTypeConvenienceDictionary = {}> = {
  [property in keyof T]: T[property] extends FacetValueType
    ? FacetValueTypeToActualType<T[property]>
    : T[property] extends FacetType
    ? FacetTypeToActualType<T[property]>
    : never;
};

export type FacetTypeWithName = { readonly name: string; readonly type: FacetType };
