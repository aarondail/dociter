export type Nullable<Type> = {
  [Property in keyof Type]: Type[Property] | null;
};

// From: https://twitter.com/mgechev/status/1240178886979223552?lang=en
export type DeepReadonly<T> = T extends (infer R)[]
  ? DeepReadonlyArray<R>
  : // eslint-disable-next-line @typescript-eslint/ban-types
  T extends Function
  ? T
  : // eslint-disable-next-line @typescript-eslint/ban-types
  T extends object
  ? DeepReadonlyObject<T>
  : T;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}

export type DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

export enum SimpleComparison {
  Equal = "EQUAL",
  Before = "BEFORE",
  After = "AFTER",
  Incomparable = "INCOMPARABLE",
}

// From: https://fettblog.eu/typescript-hasownproperty/
// eslint-disable-next-line @typescript-eslint/ban-types
export function hasOwnProperty<X extends {}, Y extends PropertyKey>(obj: X, prop: Y): obj is X & Record<Y, unknown> {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

export enum Side {
  Left = "LEFT",
  Right = "RIGHT",
}

type NoConflict<A extends Record<string | symbol, unknown>, B extends string | number | symbol> = {
  [K in keyof A]: K extends B ? never : A[K];
};

type PropsUnion<A> = { [K in keyof A]: A[K] }[keyof A];

export function enumWithMethods<
  Origin extends Record<string | symbol, unknown>,
  Methods extends Record<string | symbol, unknown>
>(
  origin: NoConflict<Origin, "T">,
  methods: NoConflict<Methods, keyof Origin | "T">
): NoConflict<Origin, "T"> & NoConflict<Methods, keyof Origin | "T"> & { T: PropsUnion<Origin> } {
  return { ...origin, ...methods, T: (null as unknown) as PropsUnion<Origin> };
}
