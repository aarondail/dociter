export enum OperationErrorCode {
  InvalidCursorPosition = "INVALID_CURSOR_POSITION",
  SelectionRequired = "SELECTION_REQUIRED",
  InvalidArgument = "INVALID_ARGUMENT",
}

export class OperationError extends Error {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public constructor(public readonly code: OperationErrorCode, message?: string) {
    super(message);
  }
}
