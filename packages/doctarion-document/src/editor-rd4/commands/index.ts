export * from "./payloads";
export * from "./types";

import * as CursorCommands from "./cursor";
// import { delete_ } from "./deletionOps";
// import * as InsertionOps from "./insertionOps";
// import * as InteractorOps from "./interactorOps";
// import * as JoinOps from "./joinOps";
// import * as SplitOps from "./splitOps";

export const Commands = {
  ...CursorCommands,
  // delete: delete_,
  // ...InsertionOps,
  // ...InteractorOps,
  // ...JoinOps,
  // ...SplitOps,
};
