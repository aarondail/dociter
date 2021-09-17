import { FancyText, Text, TextStyleStrip } from "../text-model-rd4";

import { Facet, FacetMap } from "./facets";
import { Node, NodeCategory, NodeChildrenType, NodeType } from "./node";

export abstract class Inline extends Node {
  public static readonly category = NodeCategory.Inline;
}

export class Span extends Inline {
  public static readonly childrenType: NodeChildrenType = NodeChildrenType.FancyText;
  public static readonly facets = FacetMap.empty;
  public static readonly nodeName = "Span";

  public readonly children: FancyText;

  public constructor(text: FancyText | Text, public readonly styles?: TextStyleStrip) {
    super();
    this.children = text;
  }

  public get nodeType(): NodeType {
    return Span;
  }
}

export const SpanType: NodeType = Span;

export class Hyperlink extends Inline {
  public static readonly childrenType: NodeChildrenType = NodeChildrenType.FancyText;
  public static readonly facets = new FacetMap(Facet.string("url"));
  public static readonly nodeName = "Hyperlink";

  public readonly children: FancyText;

  public constructor(public readonly url: string, text: FancyText | Text, public readonly styles?: TextStyleStrip) {
    super();
    this.children = text;
  }

  public get nodeType(): NodeType {
    return Hyperlink;
  }
}

export const HyperlinkType: NodeType = Hyperlink;

export class EntityRef extends Inline {
  public static readonly childrenType: NodeChildrenType = NodeChildrenType.None;
  public static readonly facets = new FacetMap(Facet.entityId("entityId"));
  public static readonly nodeName = "EntityRef";

  public readonly children: undefined;

  public constructor(public readonly entityId: string) {
    super();
  }

  public get nodeType(): NodeType {
    return EntityRef;
  }
}

export const EntityRefType: NodeType = EntityRef;

export class Todo extends Inline {
  public static readonly childrenType: NodeChildrenType = NodeChildrenType.FancyText;
  public static readonly facets = FacetMap.empty;
  public static readonly nodeName = "Todo";

  public readonly children: FancyText;

  public constructor(text: FancyText | Text, public readonly styles?: TextStyleStrip) {
    super();
    this.children = text;
  }

  public get nodeType(): NodeType {
    return Todo;
  }
}

export const TodoType: NodeType = Todo;

export class Tag extends Inline {
  public static readonly childrenType: NodeChildrenType = NodeChildrenType.FancyText;
  public static readonly facets = FacetMap.empty;
  public static readonly nodeName = "Tag";

  public readonly children: FancyText;

  public constructor(text: FancyText | Text) {
    super();
    this.children = text;
  }

  public get nodeType(): NodeType {
    return Tag;
  }
}

export const TagType: NodeType = Tag;
