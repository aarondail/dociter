import { Block } from "./blocks";
import { NodeKind, NodeLayoutType, ObjectNode } from "./node";

export abstract class BlockContainingNode extends ObjectNode {
  public abstract children: readonly Block[];
  public abstract kind: NodeKind.Document;
  public layoutType: NodeLayoutType.Block = NodeLayoutType.Block;
}

export class Document extends BlockContainingNode {
  public readonly children: readonly Block[];
  public readonly kind = NodeKind.Document;
  public readonly layoutType = NodeLayoutType.Block;
  public readonly title: string;

  public constructor(title: string, ...blocks: readonly Block[]) {
    super();
    this.title = title;
    this.children = blocks;
  }
}
