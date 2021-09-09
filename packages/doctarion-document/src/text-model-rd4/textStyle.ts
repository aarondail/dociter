export enum TextStyleSemanticPurpose {
  Quote,
  Emphasis,
  Subtle,
  InternalThinking,
  TechnicalTerm,
  Code,
  Unusual,
}

// TODO maybe make class?
export interface TextStyle {
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly strikeThrough?: boolean;
  readonly purpose?: TextStyleSemanticPurpose;
  readonly foregroundColor?: string;
  readonly backgroundColor?: string;
}
