import { FancyText, Text, TextStyleStrip } from "../text-model-rd4";

import { Facet, FacetMap } from "./facets";
import { Node, NodeCategory, NodeChildrenType, NodeType } from "./node";

export abstract class Inline extends Node {}

export const SpanType: NodeType = new NodeType(
  "Span",
  NodeCategory.Inline,
  NodeChildrenType.FancyText,
  new FacetMap(Facet.textStyleStrip("styles", true))
);

export class Span extends Inline {
  public readonly children: FancyText;

  public constructor(text: FancyText | Text, public readonly styles?: TextStyleStrip) {
    super();
    this.children = text;
  }

  public get nodeType(): NodeType {
    return SpanType;
  }
}

export const HyperlinkType: NodeType = new NodeType(
  "Hyperlink",
  NodeCategory.Inline,
  NodeChildrenType.FancyText,
  new FacetMap(Facet.text("url"), Facet.textStyleStrip("styles", true))
);

export class Hyperlink extends Inline {
  public readonly children: FancyText;

  public constructor(public readonly url: Text, text: FancyText | Text, public readonly styles?: TextStyleStrip) {
    super();
    this.children = text;
  }

  public get nodeType(): NodeType {
    return HyperlinkType;
  }
}

export const EntityRefType: NodeType = new NodeType(
  "EntityRef",
  NodeCategory.Inline,
  NodeChildrenType.None,
  new FacetMap(Facet.entityId("entityId"))
);

export class EntityRef extends Inline {
  public readonly children: undefined;

  public constructor(public readonly entityId: string) {
    super();
  }

  public get nodeType(): NodeType {
    return EntityRefType;
  }
}

export const TodoType: NodeType = new NodeType(
  "Todo",
  NodeCategory.Inline,
  NodeChildrenType.FancyText,
  new FacetMap(Facet.textStyleStrip("styles", true))
);

export class Todo extends Inline {
  public readonly children: FancyText;

  public constructor(text: FancyText | Text, public readonly styles?: TextStyleStrip) {
    super();
    this.children = text;
  }

  public get nodeType(): NodeType {
    return TodoType;
  }
}

export const TagType: NodeType = new NodeType("Tag", NodeCategory.Inline, NodeChildrenType.FancyText, FacetMap.empty);

export class Tag extends Inline {
  public readonly children: FancyText;

  public constructor(text: FancyText | Text) {
    super();
    this.children = text;
  }

  public get nodeType(): NodeType {
    return TagType;
  }
}
