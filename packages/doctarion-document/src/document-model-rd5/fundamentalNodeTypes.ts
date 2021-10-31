import { FacetType } from "./facets";
import { NodeOfType } from "./misc";
import { NodeCategory, NodeChildrenType, NodeType } from "./nodeType";

export const Document = new NodeType({
  name: "Document",
  category: NodeCategory.SuperBlock,
  childrenType: NodeChildrenType.BlocksAndSuperBlocks,
  facets: {
    annotations: {
      type: FacetType.NodeArray,
      nodeCategory: NodeCategory.Annotation,
    },
    laterals: {
      type: FacetType.NodeArray,
      NodeCategory: NodeCategory.Lateral,
    },
  },
});

// Because document nodes are so important, we export a specific type for them
export type DocumentNode = NodeOfType<typeof Document>;

export const Paragraph = new NodeType({
  name: "Paragraph",
  category: NodeCategory.Block,
  childrenType: NodeChildrenType.Inlines,
});

export const Span = new NodeType({
  name: "Span",
  category: NodeCategory.Inline,
  childrenType: NodeChildrenType.FancyText,
  facets: {
    styles: FacetType.TextStyleStrip,
  },
});
