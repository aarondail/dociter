/**
 * This generates friendly unique ids of the form:
 * `{prefix}-{counter}-{random-base-32-string}`
 *
 * E.g. Doc-12-8ptd1b69gg8
 */
export class FriendlyIdGenerator {
  private counter: number;
  public constructor() {
    this.counter = 1;
  }

  /**
   * Generate a new friendly random id.
   *
   * @param prefix Some string to prefix the id with. Don't include dashses in
   * this.
   */
  public generateId(prefix = "Id"): string {
    const right = Math.random().toString(32).slice(2);
    const id = `${prefix}-${this.counter}-${right}`;
    this.counter++;
    return id;
  }

  /**
   * This is used to make sure the generator will generate new ids with
   * a "counter" larger than this already used one.
   */
  public noteUsedId(friendlyId: string): void {
    const counterPart = friendlyId.split("-")[1];
    if (counterPart) {
      const counterFromId = +counterPart;
      if (!isNaN(counterFromId)) {
        this.counter = counterFromId + 1;
      }
    }
  }
}
