import { Anchor, AnchorRange } from "./anchor";
import { BlockNode } from "./blocks";
import { Facet, FacetMap } from "./facets";
import { Node, NodeCategory, NodeChildrenType, NodeType } from "./node";

/**
 * Laterals appear to the side of the main content.
 */
export abstract class Lateral extends Node {}

export const SidebarType: NodeType = new NodeType(
  "Sidebar",
  NodeCategory.Lateral,
  NodeChildrenType.Blocks,
  new FacetMap(Facet.anchor("anchor"))
);

export class Sidebar extends Lateral {
  public constructor(public readonly children: readonly BlockNode[], public readonly anchor: Anchor) {
    super();
  }

  public get nodeType(): NodeType {
    return SidebarType;
  }
}

export const ExtendedCommentType: NodeType = new NodeType(
  "ExtendedComment",
  NodeCategory.Lateral,
  NodeChildrenType.Blocks,
  new FacetMap(Facet.anchorOrAnchorRange("anchors"))
);

export class ExtendedComment extends Lateral {
  public constructor(public readonly children: readonly BlockNode[], public readonly anchors: Anchor | AnchorRange) {
    super();
  }

  public get nodeType(): NodeType {
    return ExtendedCommentType;
  }
}
