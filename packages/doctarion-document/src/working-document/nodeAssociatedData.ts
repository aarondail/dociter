/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Node } from "../models";

import { AnchorId } from "./anchor";

export type NodeId = string;

const symbol = Symbol("WorkingDocumentNodeAssociatedData");

interface NodeAssociatedData {
  id?: NodeId;
  parentId?: NodeId;
  anchorIds?: AnchorId[];
}

const getData = (node: Node): NodeAssociatedData => {
  let data = (node as any)[symbol];
  if (!data) {
    data = {};
    (node as any)[symbol] = data;
  }
  return data;
};

export const NodeAssociatedData = {
  /**
   * Assigns an id to this node. Note that graphemes cannot be assigned ids.
   */
  assignId(node: Node, id: NodeId): void {
    if (typeof node === "string") {
      throw new Error("Cannot assign a node id to graphemes.");
    }
    getData(node).id = id;
  },

  /**
   * This gets the id _previously assigned_ to this node (via `assignId`). Also
   * note that graphemes cannot have node ids.
   */
  getId(node: Node): NodeId | undefined {
    return getData(node).id;
  },

  assignParentId(node: Node, id: NodeId): void {
    if (typeof node === "string") {
      throw new Error("Cannot assign a parent node id to graphemes.");
    }
    getData(node).parentId = id;
  },

  getParentId(node: Node): NodeId | undefined {
    return getData(node).parentId;
  },

  addAnchorToNode(node: Node, id: AnchorId): void {
    if (typeof node === "string") {
      throw new Error("Cannot assign an anchor to graphemes.");
    }
    const data = getData(node);
    if (!data.anchorIds) {
      data.anchorIds = [];
    }
    data.anchorIds.push(id);
  },

  getAnchorsAtNode(node: Node): readonly AnchorId[] | undefined {
    if (typeof node === "string") {
      throw new Error("Cannot get anchors on graphemes.");
    }
    return getData(node).anchorIds;
  },

  removeAnchorFromNode(node: Node, id: AnchorId): void {
    if (typeof node === "string") {
      throw new Error("Cannot remove an anchor from graphemes.");
    }
    const array = getData(node).anchorIds;
    if (!array) {
      return;
    }
    const index = array.indexOf(id);
    if (index !== -1) {
      array.splice(index, 1);
    }
  },
};
