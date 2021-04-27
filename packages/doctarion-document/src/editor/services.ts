import { FriendlyIdGenerator } from "doctarion-utils";
import { Draft } from "immer";
import lodash from "lodash";

import { Chain, NodeNavigator, Path } from "../basic-traversal";
import { NodeLayoutProvider, NodeLayoutReporter } from "../layout-reporting";
import { Node, NodeUtils } from "../models";

import { EditorState } from "./editor";
import { NodeId } from "./nodeId";

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
  // Note the editorState can _and will_ be updated by the Editor
  public constructor(public editorState: EditorState) {}

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
      const lastLink = lodash.last(chain);
      if (lastLink) {
        return lastLink.node;
      }
    }
    return undefined;
  }

  public getPathTo(nodeId: NodeId): Path | undefined {
    const chain = this.getChainTo(nodeId);
    if (chain) {
      return Chain.getPath(chain);
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
  private idGenerator: FriendlyIdGenerator;

  // Note the editorState can _and will_ be updated by the Editor
  public constructor(public editorState: Draft<EditorState>) {
    this.idGenerator = new FriendlyIdGenerator();
  }

  public notifyNodeMoved(node: Node, newParentId: NodeId): void {
    const id = NodeId.getId(node);
    if (id) {
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
    if (parentId) {
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
    if (id) {
      delete this.editorState.nodeParentMap[id];
    }
  }
}

// -----------------------------------------------------------------------------
// Third, the layout service
// -----------------------------------------------------------------------------

/**
 * This service provides a way for document rendering code (that exists outside
 * this library and uses the Editor) to inform the Editor and the operations
 * about how the document is being rendered. The rendering code registers
 * `NodeLayoutProvider`s for the nodes (aside from graphemes as they lack
 * ids) as they are rendered. The providers then give the operations the
 * ability to figure out where the nodes are by getting their LayoutRect.
 *
 * This information is used to deal with moving the cursor down visual lines,
 * for positioning the cursor intelligently around line wraps, and other
 * things.
 */
export class EditorNodeLayoutService extends NodeLayoutReporter {
  private layoutProviders: Map<NodeId, NodeLayoutProvider>;

  public constructor() {
    super((node: Node) => this.getProviderForNode(node));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.layoutProviders = new Map();
  }

  public getProvider(nodeId: NodeId): NodeLayoutProvider | undefined {
    return this.getProviderForId(nodeId);
  }

  public removeProvider(nodeId: NodeId, provider: NodeLayoutProvider): void {
    if (this.getProviderForId(nodeId) === provider) {
      this.layoutProviders.delete(nodeId);
    }
  }

  public setProvider(nodeId: NodeId, provider: NodeLayoutProvider | undefined): void {
    if (provider) {
      this.layoutProviders.set(nodeId, provider);
    } else {
      this.layoutProviders.delete(nodeId);
    }
  }

  private getProviderForId(nodeId: NodeId): NodeLayoutProvider | undefined {
    return this.layoutProviders.get(nodeId);
  }

  private getProviderForNode = (node: Node) => {
    const id = NodeId.getId(node);
    if (id) {
      return this.getProviderForId(id);
    }
    return undefined;
  };
}

// -----------------------------------------------------------------------------
// Finally, types that represent all the services
// -----------------------------------------------------------------------------

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
   * The layout service doesn't layout nodes, rather it records layout
   * information about nodes.
   *
   * Because of that, it has to be populated with information about how the
   * nodes are laid out and updated as nodes are created and removed.
   */
  readonly layout: EditorNodeLayoutService;
}

/**
 * These are all the services available to clients of the Editor.
 */
export type EditorServices = Pick<EditorOperationServices, "lookup" | "layout">;
