export enum EditorOperationErrorCode {
  InvalidCursorPosition = "INVALID_CURSOR_POSITION",
  SelectionRequired = "SELECTION_REQUIRED",
  SelectionNotAllowed = "SELECTION_NOT_ALLOWED",
  InvalidArgument = "INVALID_ARGUMENT",
  UnknownOperation = "UNKNOWN_OPERATION",
  UnexpectedState = "UNEXPECTED_STATE",
}

export class EditorOperationError extends Error {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public constructor(public readonly code: EditorOperationErrorCode, message?: string) {
    super(message);
  }
}
