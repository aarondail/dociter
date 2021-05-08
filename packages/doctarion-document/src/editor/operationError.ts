export enum EditorOperationErrorCode {
  InvalidCursorPosition = "INVALID_CURSOR_POSITION",
  SelectionRequired = "SELECTION_REQUIRED",
  InvalidArgument = "INVALID_ARGUMENT",
}

export class EditorOperationError extends Error {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public constructor(public readonly code: EditorOperationErrorCode, message?: string) {
    super(message);
  }
}
