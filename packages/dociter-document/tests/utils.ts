/* eslint-disable @typescript-eslint/unbound-method */
import * as Models from "../src/models";

export const doc = (...blocks: readonly Models.Block[]): Models.Document => Models.Document.new("title", ...blocks);
export const header = Models.Block.header;
export const paragraph = Models.Block.paragraph;
export const inlineText = Models.InlineText.new;
export const inlineUrlLink = Models.InlineUrlLink.new;
