/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Anchor,
  AnchorRange,
  AutoFlowColumns,
  BlockQuote,
  CodeBlock,
  Column,
  Columns,
  Comment,
  Document,
  EntityRef,
  ExtendedComment,
  Floater,
  Footer,
  Grid,
  GridCell,
  Header,
  Hero,
  Hyperlink,
  List,
  ListItem,
  Media,
  Node,
  Paragraph,
  Sidebar,
  Span,
  Tag,
  Todo,
} from "../document-model-rd4";
import { DeepReadonly } from "../miscUtils";
import { FancyText, Text } from "../text-model-rd4";

import { ReadonlyWorkingAnchor, WorkingAnchor, WorkingAnchorRange } from "./anchor";

export type NodeId = string;

export interface WorkingNode extends Node {
  id: NodeId;
  attachedAnchors: WorkingAnchor[];
  parent?: WorkingNode;
  children?: WorkingNode[] | Text | FancyText;
}

export interface ReadonlyWorkingNode extends Node {
  readonly id: NodeId;
  readonly attachedAnchors: readonly ReadonlyWorkingAnchor[];
  readonly parent?: ReadonlyWorkingNode;
  readonly children?: readonly ReadonlyWorkingNode[] | Text | FancyText;
}

type NodePropertyToWorkingNodeProperty<T> = T extends number
  ? number
  : T extends string
  ? string
  : T extends ReadonlyArray<infer U>
  ? Array<NodePropertyToWorkingNodeProperty<U>>
  : T extends Node
  ? NodeToWorkingNode<T>
  : T extends AnchorRange
  ? WorkingAnchorRange
  : T extends Anchor
  ? WorkingAnchor
  : never; // T;

type NodeToWorkingNode<Type extends Node> = WorkingNode &
  {
    -readonly [Property in keyof Type]: NodePropertyToWorkingNodeProperty<Type[Property]>;
  };

function CreateWorkingNode<Cls extends Node, Ctor extends new (...args: any[]) => Cls>(
  ctor: Ctor
): new (id: NodeId, ...args: ConstructorParameters<Ctor>) => NodeToWorkingNode<Cls> {
  //@ts-ignore-next-line
  const newClass = class extends ctor {
    public attachedAnchors: WorkingAnchor[];
    public id: NodeId;
    public parent?: WorkingNode;

    public constructor(id: NodeId, ...args: any[]) {
      super(...args);
      this.id = id;
      this.attachedAnchors = [];
    }

    // get asReadonly(): ReadonlyWorkingSpan {
    //   return this;
    // }
  };
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return newClass as any;
}

// Tried to get some sort of mixin to work but ran into two problems:
// 1. typescript really work when you wanna create a mixin constrained on a base
// class (Node in our case) that is abstract.
// https://github.com/microsoft/TypeScript/issues/35356
// 2. Even if that wasn't an issue, another problem is that we don't really just
// want a mixin, we want something that re-types all the properties of the base
// class to remove the readonly and also move to the working versions.

// TODO readonly/writable

// export class WorkingNode<T> extends T {
//   id;
//   parent;
//   version;
//   events: {
//     childAdded: () => void;
//     childRemoved: () => void;
//     childReordered: () => void;
//     textUpdated: () => void;
//   };
//   theNode;
// }

// export class WorkingNode {
//   id;
//   parent;
//   version;
//   events: {
//     childAdded: () => void;
//     childRemoved: () => void;
//     childReordered: () => void;
//     textUpdated: () => void;
//   };
//   theNode;
// }

// ANNOTATIONS

export const WorkingFloater = CreateWorkingNode<Floater, typeof Floater>(Floater);
export const WorkingFooter = CreateWorkingNode<Footer, typeof Footer>(Footer);
export const WorkingComment = CreateWorkingNode<Comment, typeof Comment>(Comment);

export type WorkingFloater = InstanceType<typeof WorkingFloater>;
export type WorkingFooter = InstanceType<typeof WorkingFooter>;
export type WorkingComment = InstanceType<typeof WorkingComment>;

export type ReadonlyWorkingFloater = DeepReadonly<WorkingFloater>;
export type ReadonlyWorkingFooter = DeepReadonly<WorkingFooter>;
export type ReadonlyWorkingComment = DeepReadonly<WorkingComment>;

// BLOCKS

export const WorkingParagraph = CreateWorkingNode<Paragraph, typeof Paragraph>(Paragraph);
export const WorkingHeader = CreateWorkingNode<Header, typeof Header>(Header);
export const WorkingCodeBlock = CreateWorkingNode<CodeBlock, typeof CodeBlock>(CodeBlock);
export const WorkingBlockQuote = CreateWorkingNode<BlockQuote, typeof BlockQuote>(BlockQuote);
export const WorkingHero = CreateWorkingNode<Hero, typeof Hero>(Hero);
export const WorkingMedia = CreateWorkingNode<Media, typeof Media>(Media);

export type WorkingParagraph = InstanceType<typeof WorkingParagraph>;
export type WorkingHeader = InstanceType<typeof WorkingHeader>;
export type WorkingCodeBlock = InstanceType<typeof WorkingCodeBlock>;
export type WorkingBlockQuote = InstanceType<typeof WorkingBlockQuote>;
export type WorkingHero = InstanceType<typeof WorkingHero>;
export type WorkingMedia = InstanceType<typeof WorkingMedia>;

export type ReadonlyWorkingParagraph = DeepReadonly<WorkingParagraph>;
export type ReadonlyWorkingHeader = DeepReadonly<WorkingHeader>;
export type ReadonlyWorkingCodeBlock = DeepReadonly<WorkingCodeBlock>;
export type ReadonlyWorkingBlockQuote = DeepReadonly<WorkingBlockQuote>;
export type ReadonlyWorkingHero = DeepReadonly<WorkingHero>;
export type ReadonlyWorkingMedia = DeepReadonly<WorkingMedia>;

// DOCUMENT

export const WorkingDocumentRootNode = CreateWorkingNode<Document, typeof Document>(Document);

export type WorkingDocumentRootNode = InstanceType<typeof WorkingDocumentRootNode>;

export type ReadonlyWorkingDocumentRootNode = DeepReadonly<WorkingDocumentRootNode>;

// INLINES

export const WorkingSpan = CreateWorkingNode<Span, typeof Span>(Span);
export const WorkingHyperlink = CreateWorkingNode<Hyperlink, typeof Hyperlink>(Hyperlink);
export const WorkingEntityRef = CreateWorkingNode<EntityRef, typeof EntityRef>(EntityRef);
export const WorkingTodo = CreateWorkingNode<Todo, typeof Todo>(Todo);
export const WorkingTag = CreateWorkingNode<Tag, typeof Tag>(Tag);

export type WorkingSpan = InstanceType<typeof WorkingSpan>;
export type WorkingHyperlink = InstanceType<typeof WorkingHyperlink>;
export type WorkingEntityRef = InstanceType<typeof WorkingEntityRef>;
export type WorkingTodo = InstanceType<typeof WorkingTodo>;
export type WorkingTag = InstanceType<typeof WorkingTag>;

export type ReadonlyWorkingSpan = DeepReadonly<WorkingSpan>;
export type ReadonlyWorkingHyperlink = DeepReadonly<WorkingHyperlink>;
export type ReadonlyWorkingEntityRef = DeepReadonly<WorkingEntityRef>;
export type ReadonlyWorkingTodo = DeepReadonly<WorkingTodo>;
export type ReadonlyWorkingTag = DeepReadonly<WorkingTag>;

// LATERALS

export const WorkingSidebar = CreateWorkingNode<Sidebar, typeof Sidebar>(Sidebar);
export const WorkingExtendedComment = CreateWorkingNode<ExtendedComment, typeof ExtendedComment>(ExtendedComment);

export type WorkingSidebar = InstanceType<typeof WorkingSidebar>;
export type WorkingExtendedComment = InstanceType<typeof WorkingExtendedComment>;

export type ReadonlyWorkingSidebar = DeepReadonly<WorkingSidebar>;
export type ReadonlyWorkingExtendedComment = DeepReadonly<WorkingExtendedComment>;

// SUPER BLOCKS

export const WorkingList = CreateWorkingNode<List, typeof List>(List);
export const WorkingListItem = CreateWorkingNode<ListItem, typeof ListItem>(ListItem);
export const WorkingGrid = CreateWorkingNode<Grid, typeof Grid>(Grid);
export const WorkingGridCell = CreateWorkingNode<GridCell, typeof GridCell>(GridCell);
export const WorkingColumns = CreateWorkingNode<Columns, typeof Columns>(Columns);
export const WorkingColumn = CreateWorkingNode<Column, typeof Column>(Column);
export const WorkingAutoFlowColumns = CreateWorkingNode<AutoFlowColumns, typeof AutoFlowColumns>(AutoFlowColumns);

export type WorkingList = InstanceType<typeof WorkingList>;
export type WorkingListItem = InstanceType<typeof WorkingListItem>;
export type WorkingGrid = InstanceType<typeof WorkingGrid>;
export type WorkingGridCell = InstanceType<typeof WorkingGridCell>;
export type WorkingColumns = InstanceType<typeof WorkingColumns>;
export type WorkingColumn = InstanceType<typeof WorkingColumn>;
export type WorkingAutoFlowColumns = InstanceType<typeof WorkingAutoFlowColumns>;

export type ReadonlyWorkingList = DeepReadonly<WorkingList>;
export type ReadonlyWorkingListItem = DeepReadonly<WorkingListItem>;
export type ReadonlyWorkingGrid = DeepReadonly<WorkingGrid>;
export type ReadonlyWorkingGridCell = DeepReadonly<WorkingGridCell>;
export type ReadonlyWorkingColumns = DeepReadonly<WorkingColumns>;
export type ReadonlyWorkingColumn = DeepReadonly<WorkingColumn>;
export type ReadonlyWorkingAutoFlowColumns = DeepReadonly<WorkingAutoFlowColumns>;

// TODO cleanup below

// Tried to get some sort of mixin to work but ran into two problems:
// 1. typescript really work when you wanna create a mixin constrained on a base
// class (Node in our case) that is abstract.
// https://github.com/microsoft/TypeScript/issues/35356
// 2. Even if that wasn't an issue, another problem is that we don't really just
// want a mixin, we want something that re-types all the properties of the base
// class to remove the readonly and also move to the working versions.

// export class WorkingSpan extends Span implements WorkingNode {
//   public anchors: WorkingAnchor[];
//   declare children: FancyGrapheme[];
//   public id: NodeId;
//   public parent?: WorkingNode;
//   declare styles?: TextStyleStrip;

//   public constructor(id: NodeId, text: FancyText | Text, styles?: TextStyleStrip) {
//     super(text, styles);
//     this.id = id;
//     this.anchors = [];
//   }

//   public get asReadonly(): ReadonlyWorkingSpan {
//     return this;
//   }
// }

// export interface ReadonlyWorkingSpan extends Span, ReadonlyWorkingNode {
//   readonly children: FancyText;
//   readonly nodeType: NodeType;
// }

// export class WorkingHyperlink extends Hyperlink implements WorkingNode {
//   public anchors: WorkingAnchor[];
//   declare children: FancyGrapheme[];
//   public id: NodeId;
//   public parent?: WorkingNode;
//   declare styles?: TextStyleStrip;
//   declare url: string;

//   public constructor(id: NodeId, url: string, text: FancyText | Text, styles?: TextStyleStrip) {
//     super(url, text, styles);
//     this.id = id;
//     this.anchors = [];
//   }

//   public get asReadonly(): ReadonlyWorkingSpan {
//     return this;
//   }
// }

// export interface ReadonlyWorkingHyperlink extends Span, ReadonlyWorkingNode {
//   readonly children: FancyText;
//   readonly nodeType: NodeType;
// }
