import { WorkingDocument } from "../working-document-rd4";

import { EditorOperationServices } from "./services";

export type EditorOperationRunFunction<Payload, ReturnType> = (
  state: WorkingDocument,
  services: EditorOperationServices,
  payload: Payload
) => ReturnType;

/**
 * This is like a redux action. It can be passed to the Editor's update method
 * to trigger the operation it was created from.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface EditorOperationCommand<Payload = void, ReturnType = void, Name extends string = string> {
  name: Name;
  payload: Payload;
}

export interface EditorOperation<Payload = void, ReturnType = void, Name extends string = string> {
  (payload: Payload): EditorOperationCommand<Payload, ReturnType, Name>;
  readonly operationName: Name;
  readonly operationRunFunction: EditorOperationRunFunction<Payload, ReturnType>;
}

export function createOperation<Payload = void, ReturnType = void, Name extends string = string>(
  name: Name,
  run: EditorOperationRunFunction<Payload, ReturnType>
): EditorOperation<Payload, ReturnType, Name> {
  const commandGenerator = (payload: Payload): EditorOperationCommand<Payload, ReturnType, Name> => ({ name, payload });
  // Note, cannot assign to `name` of functions...
  commandGenerator.operationName = name;
  commandGenerator.operationRunFunction = run;
  return commandGenerator;
}

export const CORE_OPERATIONS: EditorOperation<unknown, unknown, string>[] = [];

const addCoreOperation = (op: EditorOperation<unknown, unknown, string>) => {
  CORE_OPERATIONS.push(op);
};

export function createCoreOperation<Payload = void, ReturnType = void, Name extends string = string>(
  name: Name,
  run: EditorOperationRunFunction<Payload, ReturnType>
): EditorOperation<Payload, ReturnType, Name> {
  const op = createOperation<Payload, ReturnType, Name>(name, run);
  addCoreOperation(op as any);
  return op;
}
