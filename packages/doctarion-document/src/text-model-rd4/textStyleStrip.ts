import { TextStyleModifier } from "./textStyle";

export class TextStyleStrip {
  public constructor(
    public readonly styles: readonly TextStyleModifier[],
    public readonly indices: readonly number[]
  ) {}
}

// export class StyledText {
//   // TODO make styles a class?
//   public constructor(public readonly text: FancyText, public readonly styles?: ReadonlyMap<number, TextStyle>) {}
// }
