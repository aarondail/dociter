import { FriendlyIdGenerator } from "doctarion-utils";
import { Draft } from "immer";
import lodash from "lodash";

import { Chain, NodeNavigator, Path } from "../basic-traversal";
import { NodeLayoutReporter } from "../layout-reporting";
import { Node, NodeUtils } from "../models";

import { EditorEvents } from "./events";
import { NodeId } from "./nodeId";
import { EditorState } from "./state";

// -----------------------------------------------------------------------------
// Editor Services provide functionality that support operations and clients of
// the Editor. They can have their own mutable state (albeit there is a
// limitation that it cannot participate in undo and redo), and they can affect
// and access the EditorState.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// First up, the Node Lookup service.
// -----------------------------------------------------------------------------

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
    this.editorEvents.updateDone.addListener(this.handleEditorUpdateDone);
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

  private handleEditorUpdateDone = (newState: EditorState) => {
    this.editorState = newState;
  };
}

// -----------------------------------------------------------------------------
// Next, the (very important) Node Tracking service
// -----------------------------------------------------------------------------

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
  private idGenerator: FriendlyIdGenerator;

  public constructor(private readonly editorEvents: EditorEvents) {
    this.editorState = null;
    this.editorEvents.updateStart.addListener(this.handleEditorUpdateStart);
    this.editorEvents.updateDone.addListener(this.handleEditorUpdateDone);
    this.idGenerator = new FriendlyIdGenerator();
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

/**
 * These are all the services available to `EditorOperation` functions.
 */
export interface EditorOperationServices {
  readonly lookup: EditorNodeLookupService;
  /**
   * The node tracking service is responsible for assigning node ids, and
   * looking up nodes by id.
   *
   * Note: graphemes don't get assigned unique ids and that for ids to be
   * assigned, this service has to be called. It doesn't automagically assign
   * ids to new nodes.
   */
  readonly tracking: EditorNodeTrackingService;
  /**
   * The layout service doesn't layout nodes, rather it reports layout
   * information related to nodes.
   */
  readonly layout?: NodeLayoutReporter;
}

/**
 * These are all the services available to clients of the Editor.
 */
export type EditorServices = Pick<EditorOperationServices, "lookup" | "layout">;

/**
 * These are services that the Editor provides in all cases.
 */
export type EditorProvidedServices = Pick<EditorOperationServices, "tracking" | "lookup">;

/**
 * These are services that have to be provided to the editor
 */
export type EditorProvidableServices = Pick<EditorOperationServices, "layout">;
