import { Inline } from "./inlines";
import { NodeKind, NodeLayoutType, ObjectNode } from "./node";

export abstract class InlineContainingNode extends ObjectNode {
  public abstract children: readonly Inline[];
  public abstract kind: NodeKind.ParagraphBlock | NodeKind.HeaderBlock;
  public layoutType: NodeLayoutType.Block = NodeLayoutType.Block;
}

export enum HeaderLevel {
  One = "ONE",
  Two = "TWO",
  Three = "THREE",
}

export class HeaderBlock extends InlineContainingNode {
  public readonly children: Inline[];
  public readonly kind = NodeKind.HeaderBlock;
  public readonly layoutType = NodeLayoutType.Block;
  public readonly level: HeaderLevel;

  public constructor(level: HeaderLevel = HeaderLevel.One, ...children: Inline[]) {
    super();
    this.level = level;
    this.children = children;
  }
}

export class ParagraphBlock extends InlineContainingNode {
  public readonly children: Inline[];
  public readonly kind = NodeKind.ParagraphBlock;
  public readonly layoutType = NodeLayoutType.Block;

  public constructor(...children: Inline[]) {
    super();
    this.children = children;
  }
}

export type Block = HeaderBlock | ParagraphBlock;

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
