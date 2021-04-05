import { FriendlyIdGenerator } from "doctarion-utils";

import { Chain, Node, PathPart } from "../basic-traversal";

// -----------------------------------------------------------------------------
// Editor Services provide functionality that support operations and in some
// ways clients of the Editor. They dont have any state that is part of the
// EditorState, so they can't participate in things like undo or redo, but at
// the same time they can have state unlike pure utility functions.
//
// Because they have state outside the EditorState, their state can be mutable.
// But also because of that, they introduce an element of non-determinism into
// the execution of operations.
//
// We may revist this at some point but for now it seems reasonable. An
// alternative (though not the only one) design is to have some kind of Node
// class in addition to the basic model types.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// First up, the Node Id service and realted types.
// -----------------------------------------------------------------------------

export type NodeId = string;

export class EditorNodeIdService {
  private generator: FriendlyIdGenerator;
  private symbol: symbol;

  public constructor() {
    this.symbol = Symbol("editorNodeId");
    this.generator = new FriendlyIdGenerator();
  }

  public assignId(node: Node): NodeId | undefined {
    if (typeof node === "string") {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const nodeId = this.generator.generateId((node as any).kind || "DOCUMENT");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (node as any)[this.symbol] = nodeId;
    return nodeId;
  }

  public getId(node: Node): NodeId | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
    return (node as any)[this.symbol];
  }
}

// -----------------------------------------------------------------------------
// Second, the layout service and related types.
// -----------------------------------------------------------------------------

/**
 * This intentionally looks exactly like the ClientRect you get from calling
 * getBoundingClientRect() and friends in browser javascript.
 *
 * From the point of view of the editor and all related code, the units for
 * these numbers dont matter (css pixels or raw pixels or whatever).
 *
 * To be clear the x axis is expected to start at 0 on the left and increase
 * towards the right. Teh y axis is expected to start at 0 at the top of teh
 * document and increase towards the bottom.
 */
export interface LayoutRect {
  readonly bottom: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly width: number;
}

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
  getChildNodeLayouts(startOffset?: number, endOffset?: number): [NodeId, LayoutRect[]][];
  /**
   * This gets the layout rects for the code points contained (as direct
   * children) by this node.
   */
  getCodePointLayout(startOffset?: number, endOffset?: number): LayoutRect[] | undefined;
}

export class EditorNodeLayoutService {
  private layoutProviders: Map<NodeId, NodeLayoutProvider>;

  public constructor(private idService: EditorNodeIdService) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.layoutProviders = new Map();
  }

  /**
   * This can't be a Node by itself, because for code points we need the parent
   * Node.
   *
   * It could be a Path, but then we'd need the Editor to get the current
   * Document model so we could resolve the Path to the Nodes.
   */
  public getLayout(chain: Chain): LayoutRect | undefined {
    const tip = Chain.getTip(chain);
    let nodeWithProvider = tip.node;
    const isCodePoint = Node.isCodePoint(nodeWithProvider);

    if (isCodePoint) {
      const parent = Chain.getParentIfPossible(chain);
      if (!parent) {
        return undefined;
      }
      nodeWithProvider = parent.node;
    }

    const id = this.idService.getId(nodeWithProvider);
    if (!id) {
      return undefined;
    }

    const provider = this.getProvider(id);
    if (!provider) {
      return undefined;
    }

    if (isCodePoint) {
      if (!tip.pathPart) {
        return undefined;
      }
      const cpIndex = PathPart.getIndex(tip.pathPart);
      const cp = provider.getCodePointLayout(cpIndex, cpIndex);
      if (cp?.length === 1) {
        return cp[0];
      }
      return undefined;
    } else {
      return provider.getLayout();
    }
  }

  public removeProvider(nodeId: NodeId, provider: NodeLayoutProvider): void {
    if (this.getProvider(nodeId) === provider) {
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

  private getProvider(nodeId: NodeId): NodeLayoutProvider | undefined {
    return this.layoutProviders.get(nodeId);
  }
}

export interface EditorServices {
  /**
   * The id service is responsible for assigning and retrieving unique ids to
   * document Nodes.
   *
   * Note: code points don't get assigned unique ids and that for ids to be
   * assigned, this service has to be called. It doesn't automagically assign
   * ids to new nodes.
   */
  readonly ids: EditorNodeIdService;
  /**
   * The layout service doesn't layout nodes, rather it records layout
   * information about nodes.
   *
   * Because of that, it has to be populated with information about how the
   * nodes are laid out and updated as nodes are created and removed.
   */
  readonly layout: EditorNodeLayoutService;
}
