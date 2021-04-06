import { FriendlyIdGenerator } from "doctarion-utils";

import { NodeLayoutProvider, NodeLayoutReporter } from "../layout-reporting";
import { Node, NodeId } from "../nodes";

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

export class EditorNodeIdService {
  private generator: FriendlyIdGenerator;

  public constructor() {
    this.generator = new FriendlyIdGenerator();
  }

  public assignId(node: Node): NodeId | undefined {
    if (typeof node === "string") {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const nodeId = this.generator.generateId((node as any).kind || "DOCUMENT");
    Node.assignId(node, nodeId);
    return nodeId;
  }
}

// -----------------------------------------------------------------------------
// Second, the layout service and related types.
// -----------------------------------------------------------------------------

export class EditorNodeLayoutService extends NodeLayoutReporter {
  private layoutProviders: Map<NodeId, NodeLayoutProvider>;

  public constructor(private idService: EditorNodeIdService) {
    super((node: Node) => this.getProviderForNode(node));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.layoutProviders = new Map();
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
    const id = Node.getId(node);
    if (id) {
      return this.getProviderForId(id);
    }
    return undefined;
  };
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
