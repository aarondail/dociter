import { Facet, FacetMap } from "./facets";
import { Inline } from "./inlines";
import { Node, NodeCategory, NodeChildrenType, NodeType } from "./node";

export abstract class BlockNode extends Node {}

export const ParagraphType: NodeType = new NodeType(
  "Paragraph",
  NodeCategory.Block,
  NodeChildrenType.Inlines,
  FacetMap.empty
);

export class Paragraph extends BlockNode {
  public constructor(public readonly children: readonly Inline[]) {
    super();
  }

  public get nodeType(): NodeType {
    return ParagraphType;
  }
}

export const BlockQuoteType: NodeType = new NodeType(
  "BlockQuote",
  NodeCategory.Block,
  NodeChildrenType.Inlines,
  FacetMap.empty
);

export class BlockQuote extends BlockNode {
  public static readonly nodeName = "BlockQuote";

  public constructor(public readonly children: readonly Inline[]) {
    super();
  }

  public get nodeType(): NodeType {
    return BlockQuoteType;
  }
}
export const HeroType: NodeType = new NodeType(
  "BlockQuote",
  NodeCategory.Block,
  NodeChildrenType.Inlines,
  FacetMap.empty
);

export class Hero extends BlockNode {
  public static readonly nodeName = "Hero";

  public constructor(public readonly children: readonly Inline[]) {
    super();
  }

  public get nodeType(): NodeType {
    return HeroType;
  }
}

export const MediaType: NodeType = new NodeType("Media", NodeCategory.Block, NodeChildrenType.None, FacetMap.empty);

export class Media extends BlockNode {
  public readonly children: undefined;

  public constructor() {
    super();
  }

  public get nodeType(): NodeType {
    return MediaType;
  }
}

export const CodeBlockType: NodeType = new NodeType(
  "CodeBlock",
  NodeCategory.Block,
  NodeChildrenType.Inlines,
  new FacetMap(Facet.text("language", true))
);

export class CodeBlock extends BlockNode {
  public constructor(public readonly children: readonly Inline[], public readonly language?: Text) {
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

export const HeaderType: NodeType = new NodeType(
  "Header",
  NodeCategory.Block,
  NodeChildrenType.Inlines,
  new FacetMap(Facet.enum("level", Object.values(HeaderLevel)))
);

export class Header extends BlockNode {
  public constructor(public readonly children: readonly Inline[], public readonly level: HeaderLevel) {
    super();
  }

  public get nodeType(): NodeType {
    return HeaderType;
  }
}
