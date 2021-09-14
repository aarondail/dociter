import { Anchor, AnchorRange } from "./anchor";
import { Facet, FacetMap } from "./facets";
import { Inline } from "./inlines";
import { Node, NodeCategory, NodeChildrenType, NodeType } from "./node";

export type AnnotationAnchors = Anchor | AnchorRange;

/**
 * Annotations appear with content in blocks (and such), rather than off "to the side",
 */
export abstract class Annotation extends Node {
  public static readonly category = NodeCategory.Annotation;
  public static readonly childrenType: NodeChildrenType = NodeChildrenType.Inlines;
}

export enum FloaterPlacement {
  Above = "ABOVE",
  Below = "BELOW",
}

export class Floater extends Annotation {
  public static readonly facets = new FacetMap(
    Facet.anchorOrAnchorRange("anchors"),
    Facet.enum("placement", Object.values(FloaterPlacement))
  );

  public static readonly nodeName = "Floater";

  public constructor(
    public readonly children: readonly Inline[],
    public readonly anchors: AnnotationAnchors,
    public readonly placement: FloaterPlacement
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return Floater;
  }
}

export const FloaterType: NodeType = Floater;

export class Footer extends Annotation {
  public static readonly facets = new FacetMap(Facet.anchor("anchor"));
  public static readonly nodeName = "Footer";

  public constructor(public readonly children: readonly Inline[], public readonly anchor: Anchor) {
    super();
  }

  public get nodeType(): NodeType {
    return Footer;
  }
}

export const FooterType: NodeType = Footer;

export class Comment extends Annotation {
  public static readonly facets = new FacetMap(Facet.anchor("anchor"));
  public static readonly nodeName = "Comment";

  public constructor(public readonly children: readonly Inline[], public readonly anchor: Anchor) {
    super();
  }

  public get nodeType(): NodeType {
    return Comment;
  }
}

export const CommentType: NodeType = Comment;
