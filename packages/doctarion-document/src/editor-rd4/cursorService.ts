import { Path, PathPart } from "../basic-traversal-rd4";
import { Cursor, CursorOrientation } from "../cursor-traversal-rd4";
import { AnchorOrientation } from "../document-model-rd4";
import { AnchorId, ReadonlyWorkingAnchor, ReadonlyWorkingDocument } from "../working-document-rd4";

import { EditorError } from "./error";

export class CursorService {
  public constructor(private workingDocument: ReadonlyWorkingDocument) {}

  public anchorToCursor(anchor: AnchorId | ReadonlyWorkingAnchor): Cursor {
    const resolvedAnchor = this.workingDocument.allAnchors.get(typeof anchor === "string" ? anchor : anchor.id);
    if (!resolvedAnchor) {
      throw new EditorError("Unknown anchor");
    }

    const path = this.workingDocument.getNodePath(resolvedAnchor.node);
    if (resolvedAnchor.graphemeIndex !== undefined) {
      // Normalize
      let { graphemeIndex, orientation } = resolvedAnchor;
      if (orientation === AnchorOrientation.Before) {
        const nodeKids = resolvedAnchor.node.children;
        if (nodeKids && graphemeIndex !== 0) {
          graphemeIndex--;
          orientation = AnchorOrientation.After;
        }
      }

      return new Cursor(
        new Path(...path.parts, new PathPart(graphemeIndex)),
        (orientation as unknown) as CursorOrientation
      );
    }
    return new Cursor(path, (resolvedAnchor.orientation as unknown) as CursorOrientation);
  }

  // public convertInteractorInputPositionToAnchorPosition(position: InteractorInputPosition): AnchorPosition {
  //   const nav = new CursorNavigator(this.editorState.document, this.layout);
  //   const cursor =
  //     position instanceof Cursor
  //       ? position
  //       : new Cursor(position.path instanceof Path ? position.path : Path.parse(position.path), position.orientation);

  //   if (!cursor || !nav.navigateTo(cursor)) {
  //     throw new EditorOperationError(EditorOperationErrorCode.InvalidCursorPosition, "Invalid position");
  //   }

  //   return this.cursorNavigatorToAnchorPosition(nav);
  // }

  // public cursorNavigatorToAnchorPosition(cursorNavigator: CursorNavigator): AnchorPosition {
  //   const node = cursorNavigator.tip.node;
  //   if (NodeUtils.isGrapheme(node)) {
  //     const parent = cursorNavigator.parent?.node;
  //     if (!parent) {
  //       throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState, "Grapheme lacks parent");
  //     }
  //     const parentId = NodeAssociatedData.getId(parent);
  //     if (!parentId) {
  //       throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState, "Node's parent lacks id");
  //     }
  //     return {
  //       nodeId: parentId,
  //       orientation: (cursorNavigator.cursor.orientation as unknown) as AnchorOrientation,
  //       graphemeIndex: cursorNavigator.tip.pathPart.index,
  //     };
  //   }
  //   const nodeId = NodeAssociatedData.getId(node);
  //   if (!nodeId) {
  //     throw new EditorOperationError(EditorOperationErrorCode.UnexpectedState, "Node lacks id");
  //   }
  //   return {
  //     nodeId,
  //     orientation: (cursorNavigator.cursor.orientation as unknown) as AnchorOrientation,
  //     graphemeIndex: undefined,
  //   };
  // }
}
