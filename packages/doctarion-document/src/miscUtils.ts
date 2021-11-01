export type Nullable<Type> = {
  [Property in keyof Type]: Type[Property] | null;
};

export type Mutable<Type> = {
  -readonly [Property in keyof Type]: Type[Property];
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

export type OptionValueTypeFromOptionArray<T extends readonly string[]> = T[number];

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

export const SetUtils = {
  union<T>(a: Set<T>, b: Set<T>): Set<T> {
    return new Set([...a, ...b]);
  },
  intersection<T>(a: Set<T>, b: Set<T>): Set<T> {
    return new Set([...a].filter((x) => b.has(x)));
  },
  difference<T>(a: Set<T>, b: Set<T>): Set<T> {
    return new Set([...a].filter((x) => !b.has(x)));
  },
};
