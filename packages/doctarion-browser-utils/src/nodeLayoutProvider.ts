import { LayoutRect, Node } from "doctarion-document";

import { CodeUnitLayoutProvider } from "./codeUnitLayoutProvder";
import { adjustRect } from "./utils";

export class NodeLayoutProvider {
  public constructor(public element?: HTMLElement, public node?: Node) {}

  /**
   * This can return undefined sometimes when there is literally nothing
   * renderered for the code point (e.g. if it is a whitespace in a sequence of
   * whitespace, and all the whitespace is collapsed).
   */
  public getCodeUnitLayoutProvider(): CodeUnitLayoutProvider {
    return new CodeUnitLayoutProvider(this.element);
  }

  public getDetailedLayout(): LayoutRect[] | undefined {
    if (!this.element) {
      return undefined;
    }
    const result = [];
    const rects = this.element.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      result.push(adjustRect(rects[i]));
    }
    return result;
  }

  public getLayout(): LayoutRect | undefined {
    if (!this.element) {
      return undefined;
    }
    return adjustRect(this.element.getBoundingClientRect());
  }
}
