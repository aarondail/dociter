import { FancyText } from "./fancyText";
import { TextStyle } from "./textStyle";

export class StyledText {
  public constructor(public readonly text: FancyText, public readonly styles?: ReadonlyMap<number, TextStyle>) {}
}
