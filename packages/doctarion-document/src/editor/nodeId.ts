/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Node } from "../models";

export type NodeId = string;

const nodeIdSymbol = Symbol("NodeId");

export const NodeId = {
  /**
   * Assigns an id to this node. Note that graphemes cannot be assigned ids.
   */
  assignId(node: Node, id: NodeId): void {
    if (typeof node === "string") {
      throw new Error("Cannot assign a node id to graphemes.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (node as any)[nodeIdSymbol] = id;
  },

  /**
   * This gets the id _previously assigned_ to this node (via `assignId`). Also
   * note that graphemes cannot have node ids.
   */
  getId(node: Node): NodeId | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
    return (node as any)[nodeIdSymbol];
  },
};
