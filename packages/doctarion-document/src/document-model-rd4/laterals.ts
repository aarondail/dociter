import { Anchor } from "./anchor";
import { Block } from "./blocks";
import { Facet, FacetMap } from "./facets";
import { Node, NodeCategory, NodeChildrenType, NodeType } from "./node";

/**
 * Laterals appear to the side of the main content.
 */
export abstract class Lateral extends Node {
  public static readonly category = NodeCategory.Lateral;
  public static readonly childrenType: NodeChildrenType = NodeChildrenType.Blocks;
}

export class Sidebar extends Lateral {
  public static readonly facets = FacetMap.empty;
  public static readonly nodeName = "Sidebar";

  public constructor(public readonly children: readonly Block[]) {
    super();
  }

  public get nodeType(): NodeType {
    return Sidebar;
  }
}

export const SidebarType: NodeType = Sidebar;

export class ExtendedComment extends Lateral {
  public static readonly facets = new FacetMap(Facet.anchor("anchor"));
  public static readonly nodeName = "ExtendedComment";

  public constructor(public readonly children: readonly Block[], public readonly anchor: Anchor) {
    super();
  }

  public get nodeType(): NodeType {
    return ExtendedComment;
  }
}

export const ExtendedCommentType: NodeType = ExtendedComment;
