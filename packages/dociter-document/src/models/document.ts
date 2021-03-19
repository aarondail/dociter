import { AbstractPath } from "./basics";
import { Block } from "./blocks";

export interface Document {
  readonly path: AbstractPath;
  readonly title: string;
  readonly blocks: readonly Block[];
  // sidebar: Vec<SidebarChunk>,
  // styles: ResolvedStyleSet,
}

export const Document = {
  new(path: AbstractPath, title: string, ...blocks: readonly Block[]): Document {
    return {
      path,
      title,
      blocks: blocks ?? [],
    };
  },
};
