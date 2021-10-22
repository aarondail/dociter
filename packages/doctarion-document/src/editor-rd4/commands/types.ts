import { WorkingDocument } from "../working-document-rd4";

import { EditorServices } from "./services";

export type CommandExecutionFunction<Payload, ReturnType> = (
  state: WorkingDocument,
  services: EditorServices,
  payload: Payload
) => ReturnType;

/**
 * This is like a redux action. It can be passed to the Editor's execute method
 * to trigger the operation it was created from.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface Command<Payload = void, ReturnType = void, Name extends string = string> {
  name: Name;
  payload: Payload;
}

export interface CommandGenerator<Payload = void, ReturnType = void, Name extends string = string> {
  (payload: Payload): Command<Payload, ReturnType, Name>;
}

export interface CommandInfo<Payload = void, ReturnType = void, Name extends string = string> {
  readonly name: Name;
  readonly executor: CommandExecutionFunction<Payload, ReturnType>;

  generator(payload: Payload): Command<Payload, ReturnType, Name>;
}

export function createCommand<Payload = void, ReturnType = void, Name extends string = string>(
  name: Name,
  executor: CommandExecutionFunction<Payload, ReturnType>
): CommandInfo<Payload, ReturnType, Name> {
  return {
    generator: (payload: Payload): Command<Payload, ReturnType, Name> => ({ name, payload }),
    name,
    executor,
  };
}

export const CORE_COMMANDS: readonly CommandInfo<unknown, unknown, string>[] = [];

export function coreCommand<Payload = void, ReturnType = void, Name extends string = string>(
  name: Name,
  run: CommandExecutionFunction<Payload, ReturnType>
): CommandGenerator<Payload, ReturnType, Name> {
  const command = createCommand<Payload, ReturnType, Name>(name, run);
  (CORE_COMMANDS as CommandInfo<unknown, unknown, string>[]).push(command as any);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  return command.generator;
}
