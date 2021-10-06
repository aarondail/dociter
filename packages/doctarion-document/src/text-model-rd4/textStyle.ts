import { Nullable } from "../miscUtils";

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
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly strikeThrough: boolean;
  readonly purpose: TextStyleSemanticPurpose;
  readonly foregroundColor: string;
  readonly backgroundColor: string;
}

export interface TextStyleModifier {
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly strikeThrough?: boolean;
  readonly purpose?: TextStyleSemanticPurpose | null;
  readonly foregroundColor?: string | null;
  readonly backgroundColor?: string | null;
}
