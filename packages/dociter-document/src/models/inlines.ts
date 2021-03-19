import { Text } from "./text";

export enum InlineKind {
  TEXT = "TEXT",
  URL_LINK = "URL_LINK",
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

export interface InlineText {
  readonly kind: InlineKind.TEXT;
  readonly text: Text;
  readonly modifiers?: Partial<TextModifiers>;
}

export const InlineText = {
  new(text: string | Text, modifiers?: Partial<TextModifiers>): InlineText {
    return {
      kind: InlineKind.TEXT,
      text: typeof text === "string" ? Text.fromString(text) : text,
      modifiers,
    };
  },

  split(inlineText: InlineText, index: number): [InlineText, InlineText] {
    const left = InlineText.new(inlineText.text.slice(0, index), inlineText.modifiers && { ...inlineText.modifiers });
    const right = InlineText.new(inlineText.text.slice(index), inlineText.modifiers && { ...inlineText.modifiers });
    return [left, right];
  },
};

export interface InlineUrlLink {
  readonly kind: InlineKind.URL_LINK;
  readonly text: Text;
  readonly url: string;
}

export const InlineUrlLink = {
  new(url: string, text: string | Text): InlineUrlLink {
    return {
      kind: InlineKind.URL_LINK,
      text: typeof text === "string" ? Text.fromString(text) : text,
      url,
    };
  },
};

export type Inline = InlineText | InlineUrlLink;
