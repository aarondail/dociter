import { SimpleComparison } from "../../src/miscUtils";
import {
  Path,
  PathAdjustmentDueToMoveReason,
  PathAdjustmentDueToRelativeDeletionNoChangeReason,
  PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason,
  PathComparison,
} from "../../src/traversal";

test("adjustDueToMove", () => {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const p = Path.parse;
  const t = (path: string, oldPrefix: string, newPrefix: string, newIndex: number) =>
    p(path).adjustDueToMove(p(oldPrefix), p(newPrefix), newIndex).toString();

  expect(t("0/1", "0", "2", 0)).toEqual("2/1");
  expect(t("0/1", "0", "2", 1)).toEqual("2/2");
  expect(t("0/1", "0", "2", -1)).toEqual("2/0");
  expect(t("3/4/5/6", "3/4", "1/2/3", 0)).toEqual("1/2/3/5/6");
  expect(t("3/4/5/6", "3/4", "1/2/3", 4)).toEqual("1/2/3/9/6");
  expect(t("3/4/5/6", "3/4", "1/2/3", -4)).toEqual("1/2/3/1/6");
  expect(t("", "", "2", 1)).toEqual("2");
  expect(t("0/4", "", "2", 1)).toEqual("2/1/4");
  expect(t("0/1", "0/1", "", 1)).toEqual("");
  expect(t("0/1", "0/1", "5", 1)).toEqual("5");

  expect(t("1/2/3", "1/1", "3", 1)).toEqual(PathAdjustmentDueToMoveReason.NoChangeBecauseOldPrefixDoesntMatch);
});

test("adjustDueToRelativeDeletionAt", () => {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const p = Path.parse;
  const t = (path: string, deletionAt: string) => p(path).adjustDueToRelativeDeletionAt(p(deletionAt)).toString();

  expect(t("0/1", "0")).toEqual(PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeBecauseAncestor);
  expect(t("11", "")).toEqual(PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeBecauseAncestor);

  expect(t("0/1", "0/1")).toEqual(PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeBecauseEqual);
  expect(t("", "")).toEqual(PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeBecauseEqual);

  expect(t("0/1", "0/1/2")).toEqual(PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeBecauseDescendant);
  expect(t("", "10")).toEqual(PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeBecauseDescendant);

  expect(t("0/1", "0/2")).toEqual(PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeForAnyOtherReason);
  expect(t("0/1", "0/0/0")).toEqual(PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeForAnyOtherReason);
  expect(t("0/1/2/3/4", "0/1/2/4")).toEqual(
    PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeForAnyOtherReason
  );
  expect(t("15", "16")).toEqual(PathAdjustmentDueToRelativeDeletionNoChangeReason.NoChangeForAnyOtherReason);

  // These should have an effect...
  expect(t("15", "8")).toEqual("14");
  expect(t("0/1", "0/0")).toEqual("0/0");
  expect(t("0/1/2/3/4", "0/1/1")).toEqual("0/1/1/3/4");
});

test("adjustDueToRelativeInsertionBefore", () => {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const p = Path.parse;
  const t = (path: string, deletionAt: string) => p(path).adjustDueToRelativeInsertionBefore(p(deletionAt)).toString();

  expect(t("0/1", "0/1/2")).toEqual(PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason.NoChangeBecauseDescendant);
  expect(t("", "10")).toEqual(PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason.NoChangeBecauseDescendant);

  expect(t("0/1", "0/2")).toEqual(PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason.NoChangeForAnyOtherReason);
  expect(t("0/1", "0/0/0")).toEqual(PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason.NoChangeForAnyOtherReason);
  expect(t("0/1/2/3/4", "0/1/2/4")).toEqual(
    PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason.NoChangeForAnyOtherReason
  );
  expect(t("11", "")).toEqual(PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason.NoChangeForAnyOtherReason);
  expect(t("15", "16")).toEqual(PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason.NoChangeForAnyOtherReason);

  expect(t("", "")).toEqual(PathAdjustmentDueToRelativeInsertionBeforeNoChangeReason.NoChangeForAnyOtherReason);

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
