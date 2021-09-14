import { Block } from "./blocks";
import { FacetMap } from "./facets";
import { Node, NodeCategory, NodeChildrenType, NodeType } from "./node";
import { SuperBlock } from "./superBlocks";

export class Document extends Node {
  public static readonly category = NodeCategory.SuperBlock;
  public static readonly childrenType = NodeChildrenType.BlocksAndSuperBlocks;
  public static readonly facets = FacetMap.empty;
  public static readonly nodeName = "Document";

  public constructor(public readonly children: readonly (Block | SuperBlock)[]) {
    super();
  }

  public get nodeType(): NodeType {
    return Document;
  }
}

export const DocumentType: NodeType = Document;
