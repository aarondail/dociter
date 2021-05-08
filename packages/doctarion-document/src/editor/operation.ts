import * as immer from "immer";

import { EditorOperationServices } from "./services";
import { EditorState } from "./state";

export type EditorOperationRunFunction<Payload> = (
  draft: immer.Draft<EditorState>,
  services: EditorOperationServices,
  payload: Payload
) => void;

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
}

export function createOperation<Payload = void, Id extends string = string>(
  id: Id,
  run: EditorOperationRunFunction<Payload>
): EditorOperation<Payload, Id> {
  const commandGenerator = (payload: Payload): EditorOperationCommand<Payload, Id> => ({ id, payload });
  commandGenerator.id = id;
  commandGenerator.run = run;
  return commandGenerator;
}
