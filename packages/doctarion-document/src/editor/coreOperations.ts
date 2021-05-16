import { EditorOperation, EditorOperationRunFunction, createOperation } from "./operation";

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
