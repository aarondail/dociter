export { EditorEvents } from "./events";
export * from "./editor";
export * from "./error";
export * from "./nodeId";
export * from "./services";

import * as CursorOps from "./cursorOps";
import * as DeletionOps from "./deletionOps";
import * as InsertionOps from "./insertionOps";
import * as SelectionOps from "./selectionOps";
export const Ops = {
  ...CursorOps,
  ...DeletionOps,
  ...InsertionOps,
  ...SelectionOps,
};
