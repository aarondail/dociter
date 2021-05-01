import { Node, NodeId } from "doctarion-document";

import { NodeLayoutProvider } from "./nodeLayoutProvider";

export class NodeLayoutProviderRegistry {
  private layoutProviders: Map<NodeId, NodeLayoutProvider>;

  public constructor() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.layoutProviders = new Map();
  }

  public getProviderForId(nodeId: NodeId): NodeLayoutProvider | undefined {
    return this.layoutProviders.get(nodeId);
  }

  public getProviderForNode = (node: Node): NodeLayoutProvider | undefined => {
    const id = NodeId.getId(node);
    if (id) {
      return this.getProviderForId(id);
    }
    return undefined;
  };

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
}
