/* eslint-disable @typescript-eslint/unbound-method */

import { Path } from "../src/basic-traversal";
import { CursorAffinity, CursorNavigator } from "../src/cursor";
import * as Models from "../src/models";

export const doc = (...blocks: readonly Models.Block[]): Models.Document => Models.Document.new("title", ...blocks);
export const header = Models.Block.header;
export const paragraph = Models.Block.paragraph;
export const inlineText = Models.InlineText.new;
export const inlineUrlLink = Models.InlineUrlLink.new;

export const debugPath = (nav: { path: Path }): string => Path.toString(nav.path);

export const debugCursorNavigator = (nav: CursorNavigator): string => {
  const c = nav.cursor;
  const p = Path.toString(c.at);
  if (c.affinity === CursorAffinity.Before) {
    return `<| ` + p;
  } else if (c.affinity === CursorAffinity.After) {
    return p + ` |>`;
  }
  return p;
};
