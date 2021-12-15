import { TextStyleModifier } from "./textStyle";

export interface TextStyleModifierAtGrapheme {
  readonly graphemeIndex: number;
  readonly modifier: TextStyleModifier;
}
export class TextStyleStrip {
  protected _modifiers: readonly TextStyleModifierAtGrapheme[];

  /**
   * The modifiers should be sorted (by grapheme index) AND not have duplicates
   * (two styles at the same index).
   */
  public constructor(...modifiers: readonly TextStyleModifierAtGrapheme[]) {
    this._modifiers = modifiers;
  }

  /**
   * Making this as an accessor for the sole purpose of allowing a derived class
   * to customize it.
   */
  public get modifiers(): readonly TextStyleModifierAtGrapheme[] {
    return this._modifiers;
  }
}
