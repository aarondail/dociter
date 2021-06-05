import { Path, PathComparison } from "../../src/basic-traversal/path";
import { SimpleComparison } from "../../src/miscUtils";

test("compareTo", () => {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const p = Path.parse;
  const cmp = (a: string, b: string) => p(a).compareTo(p(b));
  const {
    Equal: EQUAL,
    EarlierSibling: EARLIER_SIBLING,
    LaterSibling: LATER_SIBLING,
    EarlierBranch: EARLIER_BRANCH,
    LaterBranch: LATER_BRANCH,
    Descendent: DESCENDENT,
    Ancestor: ANCESTOR,
  } = PathComparison;

  // ANCESTOR/DESCENDANT
  expect(cmp("1", "1/10/5")).toEqual(ANCESTOR);
  expect(cmp("1/10/5", "1")).toEqual(DESCENDENT);
  expect(cmp("2/10", "2/10/5/10")).toEqual(ANCESTOR);

  // Siblings
  expect(cmp("0/1/0/0", "0/1/0/10")).toEqual(EARLIER_SIBLING);
  expect(cmp("1", "2")).toEqual(EARLIER_SIBLING);
  expect(cmp("2/10", "2/5")).toEqual(LATER_SIBLING);

  // Equal
  expect(cmp("1", "1")).toEqual(EQUAL);
  expect(cmp("0/1/0/0", "0/1/0/0")).toEqual(EQUAL);

  // Some shared ancestor
  expect(cmp("0/1/0/0", "0/2/0/10")).toEqual(EARLIER_BRANCH);
  expect(cmp("0/1/0/0", "0/1/22/10")).toEqual(EARLIER_BRANCH);
  expect(cmp("0/1/0/0", "2/1/0/0")).toEqual(EARLIER_BRANCH);
  expect(cmp("0/1/0/0", "1/1")).toEqual(EARLIER_BRANCH);
  expect(cmp("2", "1/1")).toEqual(LATER_BRANCH);
});

test("compareToSimple", () => {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const p = Path.parse;
  const cmp = (a: string, b: string) => p(a).compareToSimple(p(b));
  const { Equal, Before, After } = SimpleComparison;

  // ANCESTOR/DESCENDANT
  expect(cmp("1", "1/10/5")).toEqual(Before);
  expect(cmp("1/10/5", "1")).toEqual(After);
  expect(cmp("2/10", "2/10/5/10")).toEqual(Before);

  // Siblings
  expect(cmp("0/1/0/0", "0/1/0/10")).toEqual(Before);
  expect(cmp("1", "2")).toEqual(Before);
  expect(cmp("2/10", "2/5")).toEqual(After);

  // Equal
  expect(cmp("1", "1")).toEqual(Equal);
  expect(cmp("0/1/0/0", "0/1/0/0")).toEqual(Equal);

  // Some shared ancestor
  expect(cmp("0/1/0/0", "0/2/0/10")).toEqual(Before);
  expect(cmp("0/1/0/0", "0/1/22/10")).toEqual(Before);
  expect(cmp("0/1/0/0", "2/1/0/0")).toEqual(Before);
  expect(cmp("0/1/0/0", "1/1")).toEqual(Before);
  expect(cmp("2", "1/1")).toEqual(After);
});
