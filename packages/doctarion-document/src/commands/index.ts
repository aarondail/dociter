export * from "./error";
export * from "./payloads";
export * from "./types";
export * from "./services";
export * from "./utils";

export { DeletePayload } from "./deletionCommands";
export { InsertPayload } from "./insertionCommands";
export { JoinType, JoinPayload } from "./joinCommands";
export { SplitType, SplitPayload } from "./splitCommands";

import * as CursorCommands from "./cursorCommands";
import { deleteImplementation } from "./deletionCommands";
import { insert } from "./insertionCommands";
import * as InteractorCommands from "./interactorCommands";
import { join } from "./joinCommands";
import { split } from "./splitCommands";

export const Commands = {
  ...CursorCommands,
  delete: deleteImplementation,
  insert,
  ...InteractorCommands,
  join,
  split,
};
