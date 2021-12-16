export * from "./error";
export * from "./payloads";
export * from "./types";
export * from "./services";
export * from "./utils";

export { DeletePayload } from "./deletionCommands";
export { InsertPayload } from "./insertionCommands";
export { JoinType, JoinPayload } from "./joinCommands";
export { SplitType, SplitPayload } from "./splitCommands";
export { StylePayload } from "./styleCommands";

import * as CursorCommands from "./cursorCommands";
import { deleteImplementation } from "./deletionCommands";
import { insert } from "./insertionCommands";
import * as InteractorCommands from "./interactorCommands";
import { joinInto } from "./joinCommands";
import { split } from "./splitCommands";
import { clearTextStyle, styleText } from "./styleCommands";

export const Commands = {
  ...CursorCommands,
  clearTextStyle,
  delete: deleteImplementation,
  insert,
  ...InteractorCommands,
  joinInto,
  split,
  styleText,
};
