export { EditorEvents } from "./events";
export * from "./editor";
export * from "./operation";
export * from "./operationError";
export * from "./nodeId";
export * from "./services";
export * from "./state";

import * as CursorOps from "./cursorOps";
import * as DeletionOps from "./deletionOps";
import * as InsertionOps from "./insertionOps";
import * as SelectionOps from "./selectionOps";

export const OPS = {
  ...CursorOps,
  ...DeletionOps,
  ...InsertionOps,
  ...SelectionOps,
};
