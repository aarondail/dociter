import * as immer from "immer";

import { EditorOperationServices } from "./services";
import { EditorState } from "./state";

export type EditorOperationRunFunction<Payload> = (
  state: immer.Draft<EditorState>,
  services: EditorOperationServices,
  payload: Payload
) => void;

// export type EditorOperationPostRunFunction = (oldState: EditorState, newState: EditorState) => EditorState;

/**
 * This is like a redux action. It can be passed to the Editor's update method
 * to trigger the operation it was created from.
 */
export interface EditorOperationCommand<Payload = void, Id extends string = string> {
  id: Id;
  payload: Payload;
}

export interface EditorOperation<Payload = void, Id extends string = string> {
  (payload: Payload): EditorOperationCommand<Payload, Id>;
  readonly id: Id;
  readonly run: EditorOperationRunFunction<Payload>;
  // readonly postRun?: EditorOperationPostRunFunction;
}

export function createOperation<Payload = void, Id extends string = string>(
  id: Id,
  run: EditorOperationRunFunction<Payload>
  // postRun?: EditorOperationPostRunFunction
): EditorOperation<Payload, Id> {
  const commandGenerator = (payload: Payload): EditorOperationCommand<Payload, Id> => ({ id, payload });
  commandGenerator.id = id;
  commandGenerator.run = run;
  // commandGenerator.postRun = postRun;
  return commandGenerator;
}

export const CORE_OPERATIONS: EditorOperation<unknown, string>[] = [];

const addCoreOperation = (op: EditorOperation<unknown, string>) => {
  CORE_OPERATIONS.push(op);
};

export function createCoreOperation<Payload = void, Name extends string = string>(
  name: Name,
  run: EditorOperationRunFunction<Payload>
): EditorOperation<Payload, Name> {
  const op = createOperation(name, run);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addCoreOperation(op as any);
  return op;
}
