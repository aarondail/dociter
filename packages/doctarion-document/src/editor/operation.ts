import * as immer from "immer";
import { startCase } from "lodash";

import { CursorNavigator } from "../cursor";

import { EditorOperationServices } from "./services";
import { EditorState } from "./state";
import { getCursorNavigatorAndValidate } from "./utils";

export type EditorOperationRunFunction<Payload> = (
  state: immer.Draft<EditorState>,
  services: EditorOperationServices,
  payload: Payload
) => void;

export type EditorOperationPostRunFunction = (oldState: EditorState, newState: EditorState) => EditorState;

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
  readonly postRun?: EditorOperationPostRunFunction;
}

export function createOperation<Payload = void, Id extends string = string>(
  id: Id,
  run: EditorOperationRunFunction<Payload>,
  postRun?: EditorOperationPostRunFunction
): EditorOperation<Payload, Id> {
  const commandGenerator = (payload: Payload): EditorOperationCommand<Payload, Id> => ({ id, payload });
  commandGenerator.id = id;
  commandGenerator.run = run;
  commandGenerator.postRun = postRun;
  return commandGenerator;
}

export interface EditorCommonOperationOptions {
  preserveCursorVisualLineMovementHorizontalAnchor?: boolean;
}

export type EditorCommonOperationRunFunction<Payload> = (args: {
  state: immer.Draft<EditorState>;
  services: EditorOperationServices;
  payload: Payload;
  navigator: CursorNavigator;
}) => void;

/**
 * I'm still very much on the fence about this. Its unclear how often we want
 * the common functionality here (after we think through selection it will be
 * more clear I guess), and its not all that obvious or clear why the
 * selection/visual anchor clearing functionality is common, and I dislike the
 * name common (doesn't say much really).
 *
 * Finally, its dangerous for composition because the `postRun` isnt auto  run
 * by one operation calling another operation.be
 *
 * May need a different way to think about all this.
 */
export function createCommonOperation<Payload = void, Id extends string = string>(
  id: Id,
  run: EditorCommonOperationRunFunction<Payload>,
  options?: EditorCommonOperationOptions
): EditorOperation<Payload, Id> {
  const realRun = (state: immer.Draft<EditorState>, services: EditorOperationServices, payload: Payload) => {
    const nav = getCursorNavigatorAndValidate(state, services);
    run({ state, services, payload, navigator: nav });
  };

  const postRun = (oldState: EditorState, newState: EditorState) => {
    if (oldState.cursor !== newState.cursor) {
      if (options?.preserveCursorVisualLineMovementHorizontalAnchor) {
        if (newState.selection || newState.selectionAnchor) {
          return {
            ...newState,
            selection: undefined,
            selectionAnchor: undefined,
          };
        }
      } else {
        if (newState.selection || newState.selectionAnchor || newState.cursorVisualLineMovementHorizontalAnchor) {
          return {
            ...newState,
            selection: undefined,
            selectionAnchor: undefined,
            cursorVisualLineMovementHorizontalAnchor: undefined,
          };
        }
      }
    }
    return newState;
  };

  return createOperation(id, realRun, postRun);
}
