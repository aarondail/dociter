export type Nullable<Type> = {
  [Property in keyof Type]: Type[Property] | null;
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
