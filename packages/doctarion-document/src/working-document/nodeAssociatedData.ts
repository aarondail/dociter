/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Node } from "../models";

import { AnchorId } from "./anchor";

export type NodeId = string;

const nodeIdSymbol = Symbol("NodeId");
const nodeParentIdSymbol = Symbol("NodeParentId");
const nodeAnchorsSymbol = Symbol("NodeAnchor");

export const NodeAssociatedData = {
  /**
   * Assigns an id to this node. Note that graphemes cannot be assigned ids.
   */
  assignId(node: Node, id: NodeId): void {
    if (typeof node === "string") {
      throw new Error("Cannot assign a node id to graphemes.");
    }
    (node as any)[nodeIdSymbol] = id;
  },

  /**
   * This gets the id _previously assigned_ to this node (via `assignId`). Also
   * note that graphemes cannot have node ids.
   */
  getId(node: Node): NodeId | undefined {
    return (node as any)[nodeIdSymbol];
  },

  assignParentId(node: Node, id: NodeId): void {
    if (typeof node === "string") {
      throw new Error("Cannot assign a parent node id to graphemes.");
    }
    (node as any)[nodeParentIdSymbol] = id;
  },

  getParentId(node: Node): NodeId | undefined {
    return (node as any)[nodeParentIdSymbol];
  },

  addAnchorToNode(node: Node, id: AnchorId): void {
    if (typeof node === "string") {
      throw new Error("Cannot assign an anchor to graphemes.");
    }
    let array = (node as any)[nodeAnchorsSymbol] as any;
    if (!array) {
      array = [];
      (node as any)[nodeAnchorsSymbol] = array;
    }
    array.push(id);
  },

  getAnchorsAtNode(node: Node): readonly AnchorId[] | undefined {
    if (typeof node === "string") {
      throw new Error("Cannot get anchors on graphemes.");
    }
    return (node as any)[nodeAnchorsSymbol] as any;
  },

  removeAnchorFromNode(node: Node, id: AnchorId): void {
    if (typeof node === "string") {
      throw new Error("Cannot remove an anchor from graphemes.");
    }
    const array = (node as any)[nodeAnchorsSymbol] as any;
    if (!array) {
      return;
    }
    const index = array.indexOf(id);
    if (index !== -1) {
      array.splice(index, 1);
    }
  },
};
