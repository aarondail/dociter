import { Annotation } from "./annotations";
import { Facet, FacetMap } from "./facets";
import { Inline } from "./inlines";
import { Lateral } from "./laterals";
import { Node, NodeCategory, NodeChildrenType, NodeType } from "./node";

export abstract class Block extends Node {
  public static readonly category = NodeCategory.Block;
  public static readonly facets = new FacetMap(
    Facet.nodeArray("annotations", Annotation),
    Facet.nodeArray("laterals", Lateral)
  );

  /**
   * The reason Annotations are on a Block rather than Inlines is that
   * they can _span_ across inlines. Other than that, it would probably make sense
   * to have the inlines own these.
   */
  public abstract annotations: readonly Annotation[]; // TODO AnnotationNode class
  /**
   * Unlike the Annotations, Laterals (i.e., Sidebars and ExtendedComments),
   * these probably could be owned at the Document level. The reason they are
   * here is to intentionally say that they belong on a single Block, even if
   * they theoretically span blocks. We may change that later.
   */
  public abstract laterals: readonly Lateral[];
}

export abstract class ContentBlock extends Block {
  public static readonly childrenType = NodeChildrenType.Inlines;
}

export class Paragraph extends ContentBlock {
  public static readonly nodeName = "Paragraph";

  public constructor(
    public readonly children: readonly Inline[],
    public readonly annotations: readonly Annotation[] = [],
    public readonly laterals: readonly Lateral[] = []
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return Paragraph;
  }
}

export const ParagraphType: NodeType = Paragraph;

export class BlockQuote extends ContentBlock {
  public static readonly nodeName = "BlockQuote";

  public constructor(
    public readonly children: readonly Inline[],
    public readonly annotations: readonly Annotation[] = [],
    public readonly laterals: readonly Lateral[] = []
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return BlockQuote;
  }
}

export const BlockQuoteType: NodeType = BlockQuote;

export class Hero extends ContentBlock {
  public static readonly nodeName = "Hero";

  public constructor(
    public readonly children: readonly Inline[],
    public readonly annotations: readonly Annotation[] = [],
    public readonly laterals: readonly Lateral[] = []
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return Hero;
  }
}

export const HeroType: NodeType = Hero;

/**
 * It might seem like Media should not be a ContentBlock, but we do want
 * laterals (sidebars), and if we at some provide editable facets (e.g. caption)
 * it sorta makes sense that we could have annotations on those.
 */
export class Media extends Block {
  public static readonly childrenType = NodeChildrenType.None;
  public static readonly nodeName = "Media";

  public readonly children: undefined;

  public constructor(
    public readonly annotations: readonly Annotation[] = [],
    public readonly laterals: readonly Lateral[] = []
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return Media;
  }
}

export const MediaType: NodeType = Media;

export class CodeBlock extends ContentBlock {
  public static readonly facetTypes = FacetMap.extend(ContentBlock.facets, Facet.string("language"));
  public static readonly nodeName = "CodeBlock";

  public constructor(
    public readonly children: readonly Inline[],
    public readonly language?: string,
    public readonly annotations: readonly Annotation[] = [],
    public readonly laterals: readonly Lateral[] = []
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return CodeBlock;
  }
}

export const CodeBlockType: NodeType = CodeBlock;

export enum HeaderLevel {
  One = "ONE",
  Two = "TWO",
  Three = "THREE",
}

export class Header extends ContentBlock {
  public static readonly facetTypes = FacetMap.extend(
    ContentBlock.facets,
    Facet.enum("level", Object.values(HeaderLevel))
  );
  public static readonly nodeName = "Header";

  public constructor(
    public readonly children: readonly Inline[],
    public readonly level: HeaderLevel,
    public readonly annotations: readonly Annotation[] = [],
    public readonly laterals: readonly Lateral[] = []
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return Header;
  }
}

export const HeaderType: NodeType = Header;
