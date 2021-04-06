import { Node } from "../basic-traversal";

import { LayoutRect } from "./types";

export interface NodeLayoutProvider {
  /**
   * This gets the layout rect for the entire node.
   */
  getLayout(): LayoutRect;
  /**
   * This gets the layout rect for each of the child nodes contained by this
   * node. The returned array is in the order of child nodes, and has an array
   * of rects per node because a node can potentially be rendered in different
   * places (e.g. half on one line, half on the text line).
   *
   * This does not work for code points (i.e., Inline nodes). Use
   * `getCodePointLayout` for that.
   */
  // getChildNodeLayouts(startOffset?: number, endOffset?: number): [NodeId, LayoutRect[]][];
  /**
   * This gets the layout rects for the code points contained (as direct
   * children) by this node.
   */
  getCodePointLayout(startOffset?: number, endOffset?: number): LayoutRect[] | undefined;
}
