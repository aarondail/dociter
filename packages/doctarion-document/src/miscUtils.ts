export type Nullable<Type> = {
  [Property in keyof Type]: Type[Property] | null;
};

export type Mutable<Type> = {
  -readonly [Property in keyof Type]: Type[Property];
};

export type OptionValueTypeFromOptionArray<T extends readonly string[]> = T[number];

//#region Mapped Types Helpers for Making Mapped Types with (Conditionally) Optional Properties
// These three types come from:
// https://stackoverflow.com/questions/67552360/conditionally-apply-modifier-in-mapped-type-per-property

export type Intersection<A, B> = A & B extends infer U ? { [P in keyof U]: U[P] } : never;

export type Matching<T, SomeInterface> = {
  [K in keyof T]: T[K] extends SomeInterface ? K : never;
}[keyof T];

export type NonMatching<T, SomeInterface> = {
  [K in keyof T]: T[K] extends SomeInterface ? never : K;
}[keyof T];

//#endregion Mapped Types Helpers for Making Mapped Types with (Conditionally) Optional Properties

export enum FlowDirection {
  Backward = "BACKWARD",
  Forward = "FORWARD",
}

export enum SimpleComparison {
  Equal = "EQUAL",
  Before = "BEFORE",
  After = "AFTER",
  Incomparable = "INCOMPARABLE",
}

export enum Side {
  Left = "LEFT",
  Right = "RIGHT",
}
