import { LayoutRect } from "./rect";

export interface NodeLayoutProvider {
  /**
   * This gets the layout rect for the entire node.
   */
  getLayout(): LayoutRect;
  /**
   * This gets the layout rects for the graphemes contained (as direct
   * children) by this node.
   *
   * Note that it is possible, in the case of line wrapping, for a grapheme
   * to have multiple layout rects. (Currently only the first rect returned is
   * used by the NodeLayoutReporter).
   */
  getCodePointLayout(startOffset?: number, endOffset?: number): LayoutRect[] | undefined;
}
