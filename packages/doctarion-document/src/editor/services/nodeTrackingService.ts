import { FriendlyIdGenerator } from "doctarion-utils";
import { Draft } from "immer";

import { Node, ObjectNode } from "../../models";
import { NodeAssociatedData, NodeId } from "../../working-document";
import { EditorEvents } from "../events";
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
    this.editorEvents.operationWillRun.addListener(this.handleOperationWillRun);
    this.editorEvents.operationHasCompleted.addListener(this.handleOperationHasCompleted);
  }

  public notifyNodeMoved(node: Node, newParent: NodeId | ObjectNode): void {
    this.editorState!.document2.processNodeMoved(node, newParent);
  }

  /**
   * When a new node is added to the document, this method must be called (the
   * exception being graphemes). This method assigns the node its id.
   */
  public register(node: Node, parent: Node | undefined): NodeId | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.editorState!.document2.processNodeCreated(node as any, parent);
  }

  /**
   * When a node is removed from the document this must be called. If the node
   * is just moved to a new parent, the `notifyNodeMoved` method should be called.
   */
  public unregister(node: Node): void {
    this.editorState!.document2.processNodeDeleted(node);
  }

  private handleOperationHasCompleted = () => {
    this.editorState = null;
  };

  private handleOperationWillRun = (newState: Draft<EditorState>) => {
    this.editorState = newState;
  };
}
