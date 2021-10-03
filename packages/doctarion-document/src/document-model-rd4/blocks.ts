import { Annotation } from "./annotations";
import { Facet, FacetMap } from "./facets";
import { Inline } from "./inlines";
import { Lateral } from "./laterals";
import { Node, NodeCategory, NodeChildrenType, NodeType } from "./node";

class BlockNodeType extends NodeType {
  private static readonly baseFacets = new FacetMap(
    Facet.nodeArray("annotations", NodeCategory.Annotation),
    Facet.nodeArray("laterals", NodeCategory.Lateral)
  );

  public constructor(name: string, childrenType: NodeChildrenType, extraFacets?: FacetMap) {
    super(
      name,
      NodeCategory.Block,
      childrenType,
      extraFacets ? extraFacets.extend(BlockNodeType.baseFacets) : BlockNodeType.baseFacets
    );
  }
}

export abstract class BlockNode extends Node {
  /**
   * The reason Annotations are on a Block rather than Inlines is that
   * they can _span_ across inlines. Other than that, it would probably make sense
   * to have the inlines own these.
   */
  public abstract annotations: readonly Annotation[];
  /**
   * Unlike the Annotations, Laterals (i.e., Sidebars and ExtendedComments),
   * these probably could be owned at the Document level. The reason they are
   * here is to intentionally say that they belong on a single Block, even if
   * they theoretically span blocks. We may change that later.
   */
  public abstract laterals: readonly Lateral[];
}

export const ParagraphType: NodeType = new BlockNodeType("Paragraph", NodeChildrenType.Inlines);

export class Paragraph extends BlockNode {
  public constructor(
    public readonly children: readonly Inline[],
    public readonly annotations: readonly Annotation[] = [],
    public readonly laterals: readonly Lateral[] = []
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return ParagraphType;
  }
}

export const BlockQuoteType: NodeType = new BlockNodeType("BlockQuote", NodeChildrenType.Inlines);

export class BlockQuote extends BlockNode {
  public static readonly nodeName = "BlockQuote";

  public constructor(
    public readonly children: readonly Inline[],
    public readonly annotations: readonly Annotation[] = [],
    public readonly laterals: readonly Lateral[] = []
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return BlockQuoteType;
  }
}
export const HeroType: NodeType = new BlockNodeType("BlockQuote", NodeChildrenType.Inlines);

export class Hero extends BlockNode {
  public static readonly nodeName = "Hero";

  public constructor(
    public readonly children: readonly Inline[],
    public readonly annotations: readonly Annotation[] = [],
    public readonly laterals: readonly Lateral[] = []
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return HeroType;
  }
}

export const MediaType: NodeType = new BlockNodeType("Media", NodeChildrenType.None);

/**
 * It might seem like Media should not be a ContentBlock, but we do want
 * laterals (sidebars), and if we at some provide editable facets (e.g. caption)
 * it sorta makes sense that we could have annotations on those.
 */
export class Media extends BlockNode {
  public readonly children: undefined;

  public constructor(
    public readonly annotations: readonly Annotation[] = [],
    public readonly laterals: readonly Lateral[] = []
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return MediaType;
  }
}

export const CodeBlockType: NodeType = new BlockNodeType(
  "CodeBlock",
  NodeChildrenType.Inlines,
  new FacetMap(Facet.text("language", true))
);

export class CodeBlock extends BlockNode {
  public constructor(
    public readonly children: readonly Inline[],
    public readonly language?: Text,
    public readonly annotations: readonly Annotation[] = [],
    public readonly laterals: readonly Lateral[] = []
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return CodeBlockType;
  }
}

export enum HeaderLevel {
  One = "ONE",
  Two = "TWO",
  Three = "THREE",
}

export const HeaderType: NodeType = new BlockNodeType(
  "Header",
  NodeChildrenType.Inlines,
  new FacetMap(Facet.enum("level", Object.values(HeaderLevel)))
);

export class Header extends BlockNode {
  public constructor(
    public readonly children: readonly Inline[],
    public readonly level: HeaderLevel,
    public readonly annotations: readonly Annotation[] = [],
    public readonly laterals: readonly Lateral[] = []
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return HeaderType;
  }
}
