import { Inline } from "./inlines";

export enum BlockKind {
  HEADER = "HEADER",
  PARAGRAPH = "PARAGRAPH",
}

export enum HeaderLevel {
  ONE = "ONE",
  TWO = "TWO",
  THREE = "THREE",
}

export interface HeaderBlock {
  readonly kind: BlockKind.HEADER;
  readonly level: HeaderLevel;
  readonly content: readonly Inline[];
}

export interface ParagraphBlock {
  readonly kind: BlockKind.PARAGRAPH;
  readonly content: readonly Inline[];
}

export type Block = HeaderBlock | ParagraphBlock;

export const Block = {
  header(level: HeaderLevel = HeaderLevel.ONE, ...content: Inline[]): HeaderBlock {
    return {
      kind: BlockKind.HEADER,
      content,
      level: level,
    };
  },
  paragraph(...content: Inline[]): ParagraphBlock {
    return {
      kind: BlockKind.PARAGRAPH,
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
