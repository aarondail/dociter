import { Path, PathComparison } from "../../src/traversal/path";

describe("Path", () => {
  test("compareTo", () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const p = Path.parse;
    const cmp = (a: string, b: string) => Path.compareTo(p(a), p(b));
    const {
      EQUAL,
      EARLIER_SIBLING,
      LATER_SIBLING,
      EARLIER_BRANCH,
      LATER_BRANCH,
      DESCENDENT,
      ANCESTOR,
    } = PathComparison;

    // ANCESTOR/DESCENDANT
    expect(cmp("block:1", "block:1/content:10/run:5")).toEqual(DESCENDENT);
    expect(cmp("block:1/content:10/run:5", "block:1")).toEqual(ANCESTOR);
    expect(cmp("block:2/content:10", "block:2/content:10/run:5/cp:10")).toEqual(DESCENDENT);

    // Siblings
    expect(cmp("block:0/content:1/tr:0/cp:0", "block:0/content:1/tr:0/cp:10")).toEqual(EARLIER_SIBLING);
    expect(cmp("block:1", "block:2")).toEqual(EARLIER_SIBLING);
    expect(cmp("block:2/content:10", "block:2/content:5")).toEqual(LATER_SIBLING);

    // Equal
    expect(cmp("block:1", "block:1")).toEqual(EQUAL);
    expect(cmp("block:0/content:1/tr:0/cp:0", "block:0/content:1/tr:0/cp:0")).toEqual(EQUAL);

    // Some shared ancestor
    expect(cmp("block:0/content:1/tr:0/cp:0", "block:0/content:2/tr:0/cp:10")).toEqual(EARLIER_BRANCH);
    expect(cmp("block:0/content:1/tr:0/cp:0", "block:0/content:1/tr:22/cp:10")).toEqual(EARLIER_BRANCH);
    expect(cmp("block:0/content:1/tr:0/cp:0", "block:2/content:1/tr:0/cp:0")).toEqual(EARLIER_BRANCH);
    expect(cmp("block:0/content:1/tr:0/cp:0", "block:1/content:1")).toEqual(EARLIER_BRANCH);
    expect(cmp("block:2", "block:1/content:1")).toEqual(LATER_BRANCH);
  });
});
