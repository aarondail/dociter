import { Inline } from "./inlines";

export enum BlockKind {
  Header = "HEADER",
  Paragraph = "PARAGRAPH",
}

export enum HeaderLevel {
  One = "ONE",
  Two = "TWO",
  Three = "THREE",
}

export interface HeaderBlock {
  readonly kind: BlockKind.Header;
  readonly level: HeaderLevel;
  readonly content: readonly Inline[];
}

export interface ParagraphBlock {
  readonly kind: BlockKind.Paragraph;
  readonly content: readonly Inline[];
}

export type Block = HeaderBlock | ParagraphBlock;

export const Block = {
  header(level: HeaderLevel = HeaderLevel.One, ...content: Inline[]): HeaderBlock {
    return {
      kind: BlockKind.Header,
      content,
      level: level,
    };
  },
  paragraph(...content: Inline[]): ParagraphBlock {
    return {
      kind: BlockKind.Paragraph,
      content,
    };
  },
};
// List(List),
// Spacer,
// Floater {
//     horizontal_attachment: FloaterHorizontalAttachment,
//     vertical_offset_suggestion: u32, // TODO this should be more sophisticated
//     blocks: Vec<Block>,
// },
// TODO Table

// pub enum FloaterHorizontalAttachment {
//     Left,
//     Right,
// }
// pub enum ListType {
//     Bullet { bullet: Option<char> },
//     OrderedNumeric,
//     OrderedAlphabeticUppercase,
//     OrderedAlphabeticLowercase,
//     Definition,
//     Checkbox,
// }

// pub struct ListItem {
//     pub mark: Option<String>,
//     pub checked: Option<bool>,
//     pub blocks: Vec<Block>,
//     pub indent_level: u8,
// }

// pub struct List {
//     list_type: ListType,
//     items: Vec<ListItem>,
// }
//
// pub struct SidebarChunk {
//     attachment_path: Vec<u32>,
//     blocks: Vec<SidebarChunkBlock>,
// }

// pub enum SidebarChunkBlock {
//     Paragraph(Paragraph),
//     List(List),
// }
