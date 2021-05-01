export interface EventChannel<T = void> {
  addListener: (handler: (event: T) => void) => void;
  removeListener: (handler: (event: T) => void) => void;
}

export class EventEmitter<T = void> implements EventChannel<T> {
  private handlers: Set<(event: T) => void>;

  public constructor() {
    this.handlers = new Set();
  }

  public addListener(handler: (event: T) => void): void {
    this.handlers.add(handler);
  }

  public emit(event: T): void {
    this.handlers.forEach((h) => h(event));
  }

  public removeListener(handler: (event: T) => void): void {
    this.handlers.delete(handler);
  }
}
