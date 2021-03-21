export * from "./editor";
export * from "./error";

import * as CursorOps from "./cursorOps";
import * as DeletionOps from "./deletionOps";
import * as SelectionOps from "./selectionOps";
export const Ops = {
  ...CursorOps,
  ...DeletionOps,
  ...SelectionOps,
};
