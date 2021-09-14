import { Block } from "./blocks";
import { FacetMap } from "./facets";
import { Node, NodeCategory, NodeChildrenType, NodeType } from "./node";

export abstract class Intermediate extends Node {
  public static readonly category = NodeCategory.Intermediate;
}

export abstract class SuperBlock extends Node {
  public static readonly category = NodeCategory.SuperBlock;
}

export class ListItem extends Intermediate {
  public static readonly childrenType = NodeChildrenType.BlocksAndSuperBlocks;
  public static readonly facets = FacetMap.empty;
  public static readonly nodeName = "ListItem";

  public constructor(public readonly children: readonly (Block | SuperBlock)[]) {
    super();
  }

  public get nodeType(): NodeType {
    return ListItem;
  }
}

export const ListItemType: NodeType = ListItem;

export class List extends SuperBlock {
  public static readonly childrenType = NodeChildrenType.Specialized;
  public static readonly facets = FacetMap.empty;
  public static readonly nodeName = "List";
  public static readonly specializedChildType = ListItemType;

  public constructor(public readonly children: readonly ListItem[]) {
    super();
  }

  public get nodeType(): NodeType {
    return List;
  }
}

export const ListType: NodeType = List;

export class GridCell extends Intermediate {
  public static readonly childrenType = NodeChildrenType.BlocksAndSuperBlocks;
  public static readonly facets = FacetMap.empty;
  public static readonly nodeName = "GridCell";

  public constructor(public readonly children: readonly (Block | SuperBlock)[]) {
    super();
  }

  public get nodeType(): NodeType {
    return GridCell;
  }
}

export const GridCellType: NodeType = GridCell;

export class Grid extends SuperBlock {
  public static readonly childrenType = NodeChildrenType.Specialized;
  public static readonly facets = FacetMap.empty;
  public static readonly nodeName = "Grid";
  public static readonly specializedChildType = GridCellType;

  public constructor(
    public readonly children: readonly GridCell[],
    public readonly columns: number,
    public readonly rows: number
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return Grid;
  }
}

export const GridType: NodeType = Grid;

export class Column extends Intermediate {
  public static readonly childrenType = NodeChildrenType.BlocksAndSuperBlocks;
  public static readonly facets = FacetMap.empty;
  public static readonly nodeName = "Column";

  public constructor(public readonly children: readonly (Block | SuperBlock)[]) {
    super();
  }

  public get nodeType(): NodeType {
    return Column;
  }
}

export const ColumnType: NodeType = Column;

export class Columns extends SuperBlock {
  public static readonly childrenType = NodeChildrenType.Specialized;
  public static readonly facets = FacetMap.empty;
  public static readonly nodeName = "Columns";
  public static readonly specializedChildType = ColumnType;

  public constructor(
    public readonly children: readonly Column[],
    public readonly columns: number,
    public readonly rows: number
  ) {
    super();
  }

  public get nodeType(): NodeType {
    return Columns;
  }
}

export const ColumnsType: NodeType = Columns;

export class AutoFlowColumns extends SuperBlock {
  public static readonly childrenType = NodeChildrenType.BlocksAndSuperBlocks;
  public static readonly facets = FacetMap.empty;
  public static readonly nodeName = "AutoFlowColumns";

  public constructor(public readonly children: readonly (Block | SuperBlock)[]) {
    super();
  }

  public get nodeType(): NodeType {
    return AutoFlowColumns;
  }
}

export const AutoFlowColumnsType: NodeType = AutoFlowColumns;
