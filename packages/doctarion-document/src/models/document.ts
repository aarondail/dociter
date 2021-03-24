import { Block } from "./blocks";

export interface Document {
  readonly title: string;
  readonly blocks: readonly Block[];
  // sidebar: Vec<SidebarChunk>,
  // styles: ResolvedStyleSet,
}

export const Document = {
  new: (title: string, ...blocks: readonly Block[]): Document => {
    return {
      title,
      blocks: blocks ?? [],
    };
  },
};
