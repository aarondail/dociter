// Emblem: a sign, design, or figure that identifies or represents something.

import { Grapheme } from "./grapheme";

export enum EmblemShape {
  Circle = "CIRCLE",
  Square = "SQUARE",
  UpTriangle = "UP_TRIANGLE",
  DownTriangle = "DOWN_TRIANGLE",
}

export interface EmblemStyle {
  readonly foregroundColor?: string;
  readonly backgroundColor?: string;
  readonly borderPrimaryColor?: string;
  readonly borderSecondaryColor?: string;
}

export class Emblem {
  public constructor(
    public readonly grapheme: Grapheme,
    public readonly shape: EmblemShape,
    public readonly style?: EmblemStyle
  ) {}
}
