import {
  EditorCommonOperationOptions,
  EditorCommonOperationRunFunction,
  EditorOperation,
  EditorOperationRunFunction,
  createCommonOperation,
  createOperation,
} from "./operation";

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

export function createCoreCommonOperation<Payload = void, Name extends string = string>(
  name: Name,
  run: EditorCommonOperationRunFunction<Payload>,
  options?: EditorCommonOperationOptions
): EditorOperation<Payload, Name> {
  const op = createCommonOperation(name, run, options);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addCoreOperation(op as any);
  return op;
}
