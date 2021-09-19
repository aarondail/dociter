export class WorkingDocumentError extends Error {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public constructor(message: string) {
    super(message);
  }
}
