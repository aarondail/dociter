export * from "./error";
export * from "./payloads";
export * from "./types";
export * from "./services";
export * from "./utils";

import * as CursorCommands from "./cursorCommands";
import { delete_ } from "./deletionCommands";
// import * as InsertionOps from "./insertionOps";
import * as InteractorCommands from "./interactorCommands";
import * as JoinCommands from "./joinCommands";
// import * as SplitOps from "./splitOps";

export const Commands = {
  ...CursorCommands,
  delete: delete_,
  // ...InsertionOps,
  ...InteractorCommands,
  ...JoinCommands,
  // ...SplitOps,
};
