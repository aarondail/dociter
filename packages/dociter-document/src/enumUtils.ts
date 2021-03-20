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
