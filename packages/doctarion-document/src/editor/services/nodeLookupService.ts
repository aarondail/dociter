import { Draft } from "immer";
import lodash from "lodash";

import { Chain, NodeNavigator, Path } from "../../basic-traversal";
import { Node, NodeUtils } from "../../models";
import { NodeAssociatedData, NodeId } from "../../working-document";
import { EditorEvents } from "../events";
import { EditorState } from "../state";

// TODO delete

/**
 * Lookup nodes, and the chain to nodes, by their id.
 *
 * Note, even though graphemes are nodes they are not assigned ids and thus
 * this service never deals with them.
 */
export class EditorNodeLookupService {
  public editorState: EditorState;

  // Note the editorState can _and will_ be updated by the Editor
  public constructor(initialEditorState: EditorState, private readonly editorEvents: EditorEvents) {
    this.editorState = initialEditorState;
    this.editorEvents.operationWillRun.addListener(this.handleOperationWillRun);
    this.editorEvents.operationHasCompleted.addListener(this.handleOperationHasCompleted);
  }

  public getChainTo(nodeId: NodeId): Chain | undefined {
    return this.editorState.document2.lookupChainTo(nodeId);
  }

  /**
   * This is not a constant time (or equivalent) operation, but it should be
   * pretty fast.
   */
  public getNode(nodeId: NodeId): Node | undefined {
    return this.editorState.document2.lookupNode(nodeId);
  }

  public getPathTo(nodeId: NodeId): Path | undefined {
    const chain = this.getChainTo(nodeId);
    if (chain) {
      return chain.path;
    }
    return undefined;
  }

  private handleOperationHasCompleted = (newState: EditorState) => {
    this.editorState = newState;
  };

  private handleOperationWillRun = (newState: Draft<EditorState>) => {
    this.editorState = newState;
  };
}
