import { Block } from "./blocks";
import { NodeKind, NodeLayoutType, ObjectNode } from "./node";

export class Document extends ObjectNode {
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
