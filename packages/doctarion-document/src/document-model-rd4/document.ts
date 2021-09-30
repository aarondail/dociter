import { BlockNode } from "./blocks";
import { FacetMap } from "./facets";
import { Node, NodeCategory, NodeChildrenType, NodeType } from "./node";
import { SuperBlock } from "./superBlocks";

export const DocumentType = new NodeType(
  "Document",
  NodeCategory.SuperBlock,
  NodeChildrenType.BlocksAndSuperBlocks,
  FacetMap.empty
);

export class Document extends Node {
  public constructor(public readonly children: readonly (BlockNode | SuperBlock)[]) {
    super();
  }

  public get nodeType(): NodeType {
    return DocumentType;
  }
}
