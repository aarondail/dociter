export * from "./error";
export * from "./payloads";
export * from "./types";
export * from "./services";
export * from "./utils";

export { ChangeBlockTypePayload } from "./blockCommands";
export { DeletePayload } from "./deletionCommands";
export { InsertPayload } from "./insertionCommands";
export { JoinType, JoinPayload } from "./joinCommands";
export { ChangeInlineTypePayload, ReconstructInlinesPayload } from "./inlineCommands";
export { SplitType, SplitPayload } from "./splitCommands";
export { StylePayload } from "./styleCommands";

import { changeBlockType } from "./blockCommands";
import * as CursorCommands from "./cursorCommands";
import { deleteImplementation } from "./deletionCommands";
import { changeInlineType, reconstructInlines } from "./inlineCommands";
import { insert } from "./insertionCommands";
import * as InteractorCommands from "./interactorCommands";
import { joinInto } from "./joinCommands";
import { split } from "./splitCommands";
import { clearTextStyle, styleText } from "./styleCommands";

export const Commands = {
  ...CursorCommands,
  changeBlockType,
  changeInlineType,
  clearTextStyle,
  delete: deleteImplementation,
  insert,
  ...InteractorCommands,
  joinInto,
  reconstructInlines,
  split,
  styleText,
};
