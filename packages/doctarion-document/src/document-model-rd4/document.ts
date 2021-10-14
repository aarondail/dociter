import { Annotation } from "./annotations";
import { BlockNode } from "./blocks";
import { Facet, FacetMap } from "./facets";
import { Lateral } from "./laterals";
import { Node, NodeCategory, NodeChildrenType, NodeType } from "./node";
import { SuperBlock } from "./superBlocks";

export const DocumentType = new NodeType(
  "Document",
  NodeCategory.SuperBlock,
  NodeChildrenType.BlocksAndSuperBlocks,
  new FacetMap(
    Facet.nodeArray("annotations", NodeCategory.Annotation),
    Facet.nodeArray("laterals", NodeCategory.Lateral)
  )
);

export class Document extends Node {
  public constructor(
    public readonly children: readonly (BlockNode | SuperBlock)[],
    public readonly annotations: readonly Annotation[] = [],
    public readonly laterals: readonly Lateral[] = []
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return DocumentType;
  }
}
