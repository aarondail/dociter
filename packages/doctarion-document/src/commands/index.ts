export * from "./error";
export * from "./payloads";
export * from "./types";
export * from "./services";
export * from "./utils";

import * as CursorCommands from "./cursorCommands";
import { deleteImplementation } from "./deletionCommands";
import * as InsertionCommands from "./insertionCommands";
import * as InteractorCommands from "./interactorCommands";
import * as JoinCommands from "./joinCommands";
import * as SplitCommands from "./splitCommands";

export const Commands = {
  ...CursorCommands,
  delete: deleteImplementation,
  ...InsertionCommands,
  ...InteractorCommands,
  ...JoinCommands,
  ...SplitCommands,
};
