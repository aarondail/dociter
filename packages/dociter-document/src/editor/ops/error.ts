export enum OperationErrorCode {
  INVALID_CURSOR_POSITION = "INVALID_CURSOR_POSITION",
  NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
  OPERATION_NOT_POSSIBLE_ON_SELECTION = "OPERATION_NOT_POSSIBLE_ON_SELECTION",
  OPERATION_NOT_POSSIBLE_ON_CURSOR = "OPERATION_NOT_POSSIBLE_ON_CURSOR",
  INVALID_OPERATION_ARGUMENT = "INVALID_OPERATION_ARGUMENT",
  INVALID_CURSOR_POSITION_FOR_OPERATION = "INVALID_CURSOR_POSITION_FOR_OPERATION ",
  UNEXPECTED_ERROR = "UNEXPECTED_ERROR",
}

export class OperationError extends Error {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public constructor(public readonly code: OperationErrorCode, message?: string) {
    super(message);
  }
}
