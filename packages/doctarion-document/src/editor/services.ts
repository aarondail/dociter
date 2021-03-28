import { FriendlyIdGenerator } from "doctarion-utils";

import { Node } from "../basic-traversal";

export class EditorNodeIdService {
  private generator: FriendlyIdGenerator;
  private symbol: symbol;

  public constructor() {
    this.symbol = Symbol("editorNodeId");
    this.generator = new FriendlyIdGenerator();
  }

  public assignId(node: Node): void {
    if (typeof node === "string") {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (node as any)[this.symbol] = this.generator.generateId((node as any).kind || "DOCUMENT");
  }

  public getId(node: Node): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
    return (node as any)[this.symbol];
  }
}

export class EditorNodeLayoutService {}

export interface EditorServices {
  readonly ids: EditorNodeIdService;
  readonly layout: EditorNodeLayoutService;
}
