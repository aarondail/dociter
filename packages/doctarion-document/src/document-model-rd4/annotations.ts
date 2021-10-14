import { Anchor, AnchorRange } from "./anchor";
import { Facet, FacetMap } from "./facets";
import { Inline } from "./inlines";
import { Node, NodeCategory, NodeChildrenType, NodeType } from "./node";

/**
 * Annotations appear sorta in place with content in blocks (and such), rather
 * than off "to the side",
 */
export abstract class Annotation extends Node {}

export enum FloaterPlacement {
  Above = "ABOVE",
  Below = "BELOW",
}

export const FloaterType: NodeType = new NodeType(
  "Floater",
  NodeCategory.Annotation,
  NodeChildrenType.Inlines,
  new FacetMap(Facet.anchorOrAnchorRange("anchors"), Facet.enum("placement", Object.values(FloaterPlacement)))
);

export class Floater extends Annotation {
  public constructor(
    public readonly children: readonly Inline[],
    public readonly anchors: Anchor | AnchorRange,
    public readonly placement: FloaterPlacement
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return FloaterType;
  }
}

export const FooterType: NodeType = new NodeType(
  "Footer",
  NodeCategory.Annotation,
  NodeChildrenType.Inlines,
  new FacetMap(Facet.anchor("anchor"))
);

export class Footer extends Annotation {
  public constructor(public readonly children: readonly Inline[], public readonly anchor: Anchor) {
    super();
  }

  public get nodeType(): NodeType {
    return FooterType;
  }
}
export const CommentType: NodeType = new NodeType(
  "Comment",
  NodeCategory.Annotation,
  NodeChildrenType.Inlines,
  new FacetMap(Facet.anchorOrAnchorRange("anchors"))
);

/**
 * This is more of a above/below the line comment vs to the side (which is the
 * Lateral ExtendedComment).
 */
export class Comment extends Annotation {
  public constructor(public readonly children: readonly Inline[], public readonly anchors: Anchor | AnchorRange) {
    super();
  }

  public get nodeType(): NodeType {
    return CommentType;
  }
}
