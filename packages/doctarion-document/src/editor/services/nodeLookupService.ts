import { Draft } from "immer";
import lodash from "lodash";

import { Chain, NodeNavigator, Path } from "../../basic-traversal";
import { Node, NodeUtils } from "../../models";
import { NodeId } from "../../working-document";
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
  private editorState: EditorState;

  // Note the editorState can _and will_ be updated by the Editor
  public constructor(initialEditorState: EditorState, private readonly editorEvents: EditorEvents) {
    this.editorState = initialEditorState;
    this.editorEvents.operationWillRun.addListener(this.handleOperationWillRun);
    this.editorEvents.operationHasCompleted.addListener(this.handleOperationHasCompleted);
  }

  public getChainTo(nodeId: NodeId): Chain | undefined {
    const idChain = this.getIdChain(nodeId);
    const nav = new NodeNavigator(this.editorState.document);
    if (idChain.length === 0) {
      return undefined;
    }
    if (idChain[0] !== NodeId.getId(this.editorState.document)) {
      return undefined;
    }
    // Now walk the chain and find the matching nodes
    for (const id of idChain.slice(1)) {
      const children = NodeUtils.getChildren(nav.tip.node);
      if (!children) {
        return undefined;
      }
      const index = children.findIndex((n: Node) => NodeId.getId(n) === id);
      if (index === -1) {
        return undefined;
      }
      nav.navigateToChild(index);
    }
    return nav.chain;
  }

  /**
   * This is not a constant time (or equivalent) operation, but it should be
   * pretty fast.
   */
  public getNode(nodeId: NodeId): Node | undefined {
    const chain = this.getChainTo(nodeId);
    if (chain) {
      const lastLink = lodash.last(chain.links);
      if (lastLink) {
        return lastLink.node;
      }
    }
    return undefined;
  }

  public getPathTo(nodeId: NodeId): Path | undefined {
    const chain = this.getChainTo(nodeId);
    if (chain) {
      return chain.path;
    }
    return undefined;
  }

  private getIdChain(nodeId: string) {
    const idChain = [];
    let currentId: string | undefined = nodeId;
    while (currentId) {
      idChain.push(currentId);
      currentId = this.editorState.nodeParentMap[currentId];
    }
    idChain.reverse();
    return idChain;
  }

  private handleOperationHasCompleted = (newState: EditorState) => {
    this.editorState = newState;
  };

  private handleOperationWillRun = (newState: Draft<EditorState>) => {
    this.editorState = newState;
  };
}
