export { EditorEvents } from "./events";
export * from "./editor";
export { createOperation, EditorOperation, EditorOperationCommand, EditorOperationRunFunction } from "./operation";
export * from "./operationError";
export * from "./payloads";
export * from "./services";
export * from "./state";
export * from "./target";

import * as CursorOps from "./cursorOps";
import { delete_ } from "./deletionOps";
import * as InsertionOps from "./insertionOps";
import * as InteractorOps from "./interactorOps";
import * as JoinOps from "./joinOps";

export const OPS = {
  ...CursorOps,
  delete: delete_,
  ...InsertionOps,
  ...InteractorOps,
  ...JoinOps,
};
