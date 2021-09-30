import { BlockNode } from "./blocks";
import { FacetMap } from "./facets";
import { Node, NodeCategory, NodeChildrenType, NodeType } from "./node";

export abstract class Intermediate extends Node {}

export abstract class SuperBlock extends Node {}

export const ListItemType: NodeType = new NodeType(
  "ListItem",
  NodeCategory.Intermediate,
  NodeChildrenType.BlocksAndSuperBlocks,
  FacetMap.empty
);

export class ListItem extends Intermediate {
  public constructor(public readonly children: readonly (BlockNode | SuperBlock)[]) {
    super();
  }

  public get nodeType(): NodeType {
    return ListItemType;
  }
}

export const ListType: NodeType = new NodeType(
  "List",
  NodeCategory.SuperBlock,
  NodeChildrenType.Intermediates,
  FacetMap.empty,
  ListItemType
);

export class List extends SuperBlock {
  public constructor(public readonly children: readonly ListItem[]) {
    super();
  }

  public get nodeType(): NodeType {
    return ListType;
  }
}

export const GridCellType: NodeType = new NodeType(
  "GridCell",
  NodeCategory.Intermediate,
  NodeChildrenType.BlocksAndSuperBlocks,
  FacetMap.empty
);

export class GridCell extends Intermediate {
  public constructor(public readonly children: readonly (BlockNode | SuperBlock)[]) {
    super();
  }

  public get nodeType(): NodeType {
    return GridCellType;
  }
}

export const GridType: NodeType = new NodeType(
  "Grid",
  NodeCategory.SuperBlock,
  NodeChildrenType.Intermediates,
  FacetMap.empty,
  GridCellType
);

export class Grid extends SuperBlock {
  public constructor(
    public readonly children: readonly GridCell[],
    public readonly columns: number,
    public readonly rows: number
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return GridType;
  }
}

export const ColumnType: NodeType = new NodeType(
  "Column",
  NodeCategory.Intermediate,
  NodeChildrenType.BlocksAndSuperBlocks,
  FacetMap.empty
);

export class Column extends Intermediate {
  public static readonly childrenType = NodeChildrenType.BlocksAndSuperBlocks;
  public static readonly facets = FacetMap.empty;
  public static readonly nodeName = "Column";

  public constructor(public readonly children: readonly (BlockNode | SuperBlock)[]) {
    super();
  }

  public get nodeType(): NodeType {
    return ColumnType;
  }
}

export const ColumnsType: NodeType = new NodeType(
  "Columns",
  NodeCategory.SuperBlock,
  NodeChildrenType.Intermediates,
  FacetMap.empty,
  ColumnType
);

export class Columns extends SuperBlock {
  public constructor(
    public readonly children: readonly Column[],
    public readonly columns: number,
    public readonly rows: number
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return ColumnsType;
  }
}

export const AutoFlowColumnsType: NodeType = new NodeType(
  "AutoFlowColumns",
  NodeCategory.Intermediate,
  NodeChildrenType.BlocksAndSuperBlocks,
  FacetMap.empty
);

export class AutoFlowColumns extends SuperBlock {
  public static readonly childrenType = NodeChildrenType.BlocksAndSuperBlocks;
  public static readonly facets = FacetMap.empty;
  public static readonly nodeName = "AutoFlowColumns";

  public constructor(public readonly children: readonly (BlockNode | SuperBlock)[]) {
    super();
  }

  public get nodeType(): NodeType {
    return AutoFlowColumnsType;
  }
}
