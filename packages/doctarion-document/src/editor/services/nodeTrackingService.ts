import { FriendlyIdGenerator } from "doctarion-utils";
import { Draft } from "immer";

import { Node } from "../../models";
import { EditorEvents } from "../events";
import { NodeId } from "../nodeId";
import { EditorState } from "../state";

/**
 * The EditorNodeTrackingService is responsible for assigning unique ids to
 * nodes and maintaining the graph (aka nodeParentMap in the EditorState) of
 * the node (ids) that lets it lookup a node based on the id.
 *
 * This is intended to _only_ be used by `EditorOperation` functions.
 *
 * Note, even though graphemes are nodes they are not assigned ids and thus
 * this service never deals with them.
 */
export class EditorNodeTrackingService {
  private editorState: Draft<EditorState> | null;

  public constructor(private readonly idGenerator: FriendlyIdGenerator, private readonly editorEvents: EditorEvents) {
    this.editorState = null;
    this.editorEvents.updateStart.addListener(this.handleEditorUpdateStart);
    this.editorEvents.updateDone.addListener(this.handleEditorUpdateDone);
  }

  public notifyNodeMoved(node: Node, newParentId: NodeId): void {
    const id = NodeId.getId(node);
    if (id && this.editorState) {
      this.editorState.nodeParentMap[id] = newParentId;
    }
  }

  /**
   * When a new node is added to the document, this method must be called (the
   * exception being graphemes). This method assigns the node its id.
   */
  public register(node: Node, parent: Node | undefined): NodeId | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const nodeId = this.idGenerator.generateId((node as any).kind || "DOCUMENT");
    NodeId.assignId(node, nodeId);

    const parentId = parent && NodeId.getId(parent);
    if (parentId && this.editorState) {
      this.editorState.nodeParentMap[nodeId] = parentId;
    }

    return nodeId;
  }

  /**
   * When a node is removed from the document this must be called. If the node
   * is just moved to a new parent, the `notifyNodeMoved` method should be called.
   */
  public unregister(node: Node): void {
    const id = NodeId.getId(node);
    if (id && this.editorState) {
      delete this.editorState.nodeParentMap[id];
    }
  }

  private handleEditorUpdateDone = () => {
    this.editorState = null;
  };

  private handleEditorUpdateStart = (newState: Draft<EditorState>) => {
    this.editorState = newState;
  };
}
