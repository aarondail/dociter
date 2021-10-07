import { TextStyle, TextStyleModifier } from "./textStyle";

export interface TextStyleStripEntry {
  readonly graphemeIndex: number;
  readonly modifier: TextStyleModifier;
}
export class TextStyleStrip {
  public entries: readonly TextStyleStripEntry[];

  /**
   * The entries should be sorted (by grapheme index) AND not have duplicates
   * (two styles at the same index).
   */
  public constructor(...entries: readonly TextStyleStripEntry[]) {
    this.entries = entries;
  }
}

// export class StyledText {
//   // TODO make styles a class?
//   public constructor(public readonly text: FancyText, public readonly styles?: ReadonlyMap<number, TextStyle>) {}
// }
