import { adjustRect } from "./utils";

export class CodeUnitLayoutProvider {
  private firstChild: ChildNode | null;
  private range: Range;

  public constructor(private element?: HTMLElement) {
    this.firstChild = this.element?.firstChild || null;
    this.range = new Range();
    if (this.element) {
      this.range.selectNodeContents(this.element);
    }
  }

  /**
   * This can return undefined sometimes when there is literally nothing
   * renderered for the code point (e.g. if it is a whitespace in a sequence of
   * whitespace, and all the whitespace is collapsed).
   */
  public getCodeUnitsLayout(
    start: number,
    end: number
    // debug?: string
  ): ClientRect | undefined {
    if (!this.firstChild) {
      return undefined;
    }

    this.range.setStart(this.firstChild, start);
    this.range.setEnd(this.firstChild, end);

    const rects = this.range.getClientRects();
    if (rects.length === 0) {
      return undefined;
    } else if (rects.length === 1) {
      // console.warn("=== 1 rect", debug, rects);
      return adjustRect(rects[0]);
    } else if (rects.length === 2) {
      // console.warn("=== 2 rects", debug, rects);
      if (rects[0].width === 0) {
        return adjustRect(rects[1]);
      }
      return adjustRect(rects[1]);
    } else {
      // console.warn("> 2 rects", debug, rects);
      // throw new Error("Unexpected number of rects when getting a code point's layout.");
      return adjustRect(rects[0]);
    }
  }
}
