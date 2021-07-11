import { Path, PathComparison } from "../../src/basic-traversal/path";
import { SimpleComparison } from "../../src/miscUtils";

test("adjustDueToRelativeDeletionAt", () => {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const p = Path.parse;
  const t = (path: string, deletionAt: string) => p(path).adjustDueToRelativeDeletionAt(p(deletionAt)).toString();

  // These should have no effect... even though the deletion (in some cases)
  // removes the given path or an ancestor
  expect(t("0/1", "0")).toEqual("0/1"); // Path deleted
  expect(t("0/1", "0/1")).toEqual("0/1"); // Path deleted
  expect(t("0/1", "0/1/2")).toEqual("0/1");
  expect(t("0/1", "0/2")).toEqual("0/1");
  expect(t("0/1", "0/0/0")).toEqual("0/1");
  expect(t("0/1/2/3/4", "0/1/2/4")).toEqual("0/1/2/3/4");
  expect(t("", "10")).toEqual("");
  expect(t("11", "")).toEqual("11"); // Path deleted
  expect(t("15", "16")).toEqual("15");

  // These should have an effect...
  expect(t("15", "8")).toEqual("14");
  expect(t("0/1", "0/0")).toEqual("0/0");
  expect(t("0/1/2/3/4", "0/1/1")).toEqual("0/1/1/3/4");
});

test("adjustDueToRelativeInsertionBefore", () => {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const p = Path.parse;
  const t = (path: string, deletionAt: string) => p(path).adjustDueToRelativeInsertionBefore(p(deletionAt)).toString();

  // These should have no effect... even though the deletion (in some cases)
  // removes the given path or an ancestor
  expect(t("0/1", "0/1/2")).toEqual("0/1");
  expect(t("0/1", "0/2")).toEqual("0/1");
  expect(t("0/1", "0/0/0")).toEqual("0/1");
  expect(t("0/1/2/3/4", "0/1/2/4")).toEqual("0/1/2/3/4");
  expect(t("", "10")).toEqual("");
  expect(t("11", "")).toEqual("11");
  expect(t("15", "16")).toEqual("15");

  // These should have an effect...
  expect(t("0/1", "0")).toEqual("1/1");
  expect(t("15", "8")).toEqual("16");
  expect(t("0/1", "0/0")).toEqual("0/2");
  expect(t("0/1", "0/1")).toEqual("0/2");
  expect(t("0/1/2/3/4", "0/1/1")).toEqual("0/1/3/3/4");
});

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
