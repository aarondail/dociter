import { immerable } from "immer";

import { Path, PathPart } from "../basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation } from "../cursor";
import { NodeUtils } from "../models";
import { NodeAssociatedData, NodeId } from "../working-document";

import { EditorServices } from "./services";

/**
 * An Anchor is very similar to a Cursor, but instead of being composed of a path and an orientation it
 * is composed of a NodeId, a possible grapheme index (only used for Graphemes), and an orientation.
 *
 * It can be converted to and from a Cursor as needed, but this form makes it much easier to insert
 * and delete nodes in the Document because existing anchors (contained by interactors) do not need
 * to be updated (generally).
 */
export class Anchor {
  [immerable] = true;

  public constructor(
    public readonly nodeId: NodeId,
    public readonly orientation: CursorOrientation,
    public readonly graphemeIndex?: number
  ) {}

  public toCursor(services: EditorServices): Cursor | undefined {
    const path = services.lookup.getPathTo(this.nodeId);
    if (!path) {
      return undefined;
    }
    if (this.graphemeIndex !== undefined) {
      return new Cursor(new Path([...path.parts, new PathPart(this.graphemeIndex)]), this.orientation);
    }
    return new Cursor(path, this.orientation);
  }

  public static fromCursorNavigator(cursorNavigator: CursorNavigator): Anchor | undefined {
    const node = cursorNavigator.tip.node;
    if (NodeUtils.isGrapheme(node)) {
      const parent = cursorNavigator.parent?.node;
      if (!parent) {
        return undefined;
      }
      const parentId = NodeAssociatedData.getId(parent);
      if (!parentId) {
        return undefined;
      }
      return new Anchor(parentId, cursorNavigator.cursor.orientation, cursorNavigator.tip.pathPart.index);
    }
    const nodeId = NodeAssociatedData.getId(node);
    if (!nodeId) {
      return undefined;
    }
    return new Anchor(nodeId, cursorNavigator.cursor.orientation);
  }
}
