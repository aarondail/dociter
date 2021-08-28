import { NodeKind, NodeLayoutType, ObjectNode } from "./node";
import { Text } from "./text";

// -----------------------------------------------------------------------------
// Inlines are the only document nodes that can contain text.  Not all inlines
// do, but only inlines can.  In terms of layout the expectation is that inlines
// are laid out "in lines" with each other, and possible wrapping of their text
// or other contents.  This is opposed to blocks that are expected to occupy a
// horizontal block of space in the flow of the document.
// -----------------------------------------------------------------------------

export abstract class TextContainingNode extends ObjectNode {
  public abstract children: Text;
  public abstract kind: NodeKind.InlineText | NodeKind.InlineUrlLink;
  public layoutType: NodeLayoutType.Inline = NodeLayoutType.Inline;
  /**
   * Alias for children.
   */
  public abstract text: Text;
}

export interface TextModifiers {
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly strikethrough: boolean;
  // readonly monospace: boolean,
  readonly foregroundColor: string;
  readonly backgroundColor: string;
}

export class InlineText extends TextContainingNode {
  public readonly children: Text;
  public readonly kind = NodeKind.InlineText;
  public readonly layoutType = NodeLayoutType.Inline;
  public readonly modifiers?: Partial<TextModifiers>;

  public constructor(text: string | Text, modifiers?: Partial<TextModifiers>) {
    super();
    this.children = typeof text === "string" ? Text.fromString(text) : text;
    this.modifiers = modifiers;
  }

  public split(index: number): [InlineText, InlineText] {
    const left = new InlineText(this.children.slice(0, index), this.modifiers && { ...this.modifiers });
    const right = new InlineText(this.children.slice(index), this.modifiers && { ...this.modifiers });
    return [left, right];
  }

  /**
   * Convinence property that returns the child graphemes.  This is equivalent
   * to the children property.
   */
  public get text(): Text {
    return this.children;
  }
}

export class InlineUrlLink extends TextContainingNode {
  public readonly children: Text;
  public readonly kind = NodeKind.InlineUrlLink;
  public readonly layoutType = NodeLayoutType.Inline;
  public readonly url: string;

  public constructor(url: string, text: string | Text) {
    super();
    this.children = typeof text === "string" ? Text.fromString(text) : text;
    this.url = url;
  }

  /**
   * Convinence property that returns the child graphemes.  This is equivalent
   * to the children property.
   */
  public get text(): Text {
    return this.children;
  }
}

// Do we need text modifiers (e.g. size, background color)?
export class InlineEmoji extends ObjectNode {
  public readonly children: undefined;
  public readonly emojiId: string;
  public readonly kind = NodeKind.InlineEmoji;
  public readonly layoutType = NodeLayoutType.Inline;

  public constructor(emojiId: string) {
    super();
    this.emojiId = emojiId;
  }
}

export type Inline = InlineText | InlineUrlLink | InlineEmoji;
