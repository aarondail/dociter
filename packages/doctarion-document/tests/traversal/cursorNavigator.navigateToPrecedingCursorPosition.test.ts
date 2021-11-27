import { CursorNavigator, CursorOrientation } from "../../src";

import { CursorNavigatorTestUtils } from "./cursorNavigator.testUtils";

describe("navigateToPrecedingCursorPosition", () => {
  const backPrime = (nav: CursorNavigator, n: number) => {
    for (let i = 0; i < n; i++) {
      expect(nav.navigateToPrecedingCursorPosition()).toBe(true);
    }
  };

  describe("goes through core inline to inline scenarios", () => {
    it.each(CursorNavigatorTestUtils.coreScenariosForInlines.forPreceding)("%p", (input, output) => {
      const nav = new CursorNavigator(CursorNavigatorTestUtils.coreScenariosForInlines.parseConciseDescription(input));

      let i = 20;
      while (nav.navigateToNextCursorPosition()) {
        i--;
        if (i === 0) {
          throw new Error("looks like an infinite loop");
        }
      }

      const paths = [];
      paths.push(nav.cursor.toString());

      while (nav.navigateToPrecedingCursorPosition()) {
        if (nav.chain.parent === undefined) {
          break;
        }
        paths.push(nav.cursor.toString());
        i--;
        if (i === 0) {
          throw new Error("looks like an infinite loop");
        }
      }
      expect(paths).toEqual(CursorNavigatorTestUtils.coreScenariosForInlines.parseConciseExpectation(output));
    });
  });

  it("should navigate through graphemes", () => {
    const nav = new CursorNavigator(CursorNavigatorTestUtils.testDocs.basicDoc);
    const back = backPrime.bind(undefined, nav);
    nav.navigateTo("2/2/1", CursorOrientation.After);
    expect(nav.tip.node).toEqual("i"); // of final sentence
    back(1);
    expect(nav.cursor.toString()).toEqual("AFTER 2/2/0");
    expect(nav.tip.node).toEqual("f");
    back(2);
    expect(nav.tip.node).toEqual("G"); // GOOG
    expect(nav.cursor.toString()).toEqual("AFTER 2/1/3");
    back(1);
    expect(nav.cursor.toString()).toEqual("AFTER 2/1/2");
    back(1);
    expect(nav.cursor.toString()).toEqual("AFTER 2/1/1");
    back(1);
    expect(nav.cursor.toString()).toEqual("AFTER 2/1/0");
    expect(nav.tip.node).toEqual("G");
    back(1);
    expect(nav.cursor.toString()).toEqual("BEFORE 2/1/0");
    expect(nav.tip.node).toEqual("G");
    back(1);
    expect(nav.tip.node).toEqual("2"); // Here is some text
    back(10);
    expect(nav.tip.node).toEqual("P");
    expect(nav.cursor.toString()).toEqual("AFTER 2/0/0");
    back(2);
    expect(nav.tip.node).toEqual("t");
    expect(nav.cursor.toString()).toEqual("AFTER 1/2/3");
    back(4);
    expect(nav.tip.node).toEqual("E");
    expect(nav.cursor.toString()).toEqual("AFTER 1/1/3");
    back(4);
    expect(nav.tip.node).toEqual("t");
    expect(nav.cursor.toString()).toEqual("AFTER 1/0/16");
    back(1);
    expect(nav.tip.node).toEqual("x");
    expect(nav.cursor.toString()).toEqual("AFTER 1/0/15");
    back(14);
    expect(nav.tip.node).toEqual("e");
    expect(nav.cursor.toString()).toEqual("AFTER 1/0/1");
    back(1);
    expect(nav.tip.node).toEqual("H"); // Here is some text
    expect(nav.cursor.toString()).toEqual("AFTER 1/0/0");
    back(1);
    expect(nav.tip.node).toEqual("H"); // Here is some text
    expect(nav.cursor.toString()).toEqual("BEFORE 1/0/0");
    back(1);
    expect(nav.tip.node).toEqual("1"); // Header1
    expect(nav.cursor.toString()).toEqual("AFTER 0/0/6");
    back(6);
    expect(nav.tip.node).toEqual("H");
    expect(nav.cursor.toString()).toEqual("AFTER 0/0/0");
    back(1);
    expect(nav.tip.node).toEqual("H");
    expect(nav.cursor.toString()).toEqual("BEFORE 0/0/0");

    expect(nav.navigateToPrecedingCursorPosition()).toBeFalsy();
  });

  it("should navigate through empty insertion points", () => {
    const nav = new CursorNavigator(CursorNavigatorTestUtils.testDocs.basicDocWithEmptyInsertionPoints);

    const back = backPrime.bind(undefined, nav);
    nav.navigateTo("3/0/0", CursorOrientation.Before);
    expect(nav.tip.node).toEqual("C"); // of final sentence
    back(1);
    expect(nav.cursor.toString()).toEqual("ON 2");
    back(1);
    expect(nav.tip.node).toEqual("B");
    expect(nav.cursor.toString()).toEqual("AFTER 1/2/0");
    back(1);
    expect(nav.tip.node).toEqual("B");
    expect(nav.cursor.toString()).toEqual("BEFORE 1/2/0");
    back(1);
    expect(nav.cursor.toString()).toEqual("ON 1/1");
    back(1);
    expect(nav.tip.node).toEqual("A");
    expect(nav.cursor.toString()).toEqual("AFTER 1/0/0");
    back(1);
    expect(nav.tip.node).toEqual("A");
    expect(nav.cursor.toString()).toEqual("BEFORE 1/0/0");
    back(1);
    expect(nav.cursor.toString()).toEqual("ON 0");

    expect(nav.navigateToPrecedingCursorPosition()).toBeFalsy();
  });

  it("should navigate through between insertion points", () => {
    const nav = new CursorNavigator(CursorNavigatorTestUtils.testDocs.basicDocWithBetweenInsertionPoints);
    const back = backPrime.bind(undefined, nav);
    nav.navigateTo("2/0/0", CursorOrientation.Before);
    expect(nav.tip.node).toEqual("D"); // of final sentence
    back(1);
    expect(nav.cursor.toString()).toEqual("AFTER 1/2/0");
    expect(nav.tip.node).toEqual("C");
    back(1);
    expect(nav.cursor.toString()).toEqual("BEFORE 1/2/0");
    expect(nav.tip.node).toEqual("C");
    back(1);
    expect(nav.cursor.toString()).toEqual("AFTER 1/1/0");
    expect(nav.tip.node).toEqual("B");
    back(1);
    expect(nav.cursor.toString()).toEqual("BEFORE 1/1/0");
    expect(nav.tip.node).toEqual("B");
    back(1);
    expect(nav.cursor.toString()).toEqual("AFTER 1/0/0");
    expect(nav.tip.node).toEqual("A");
    back(1);
    expect(nav.cursor.toString()).toEqual("BEFORE 1/0/0");
    expect(nav.tip.node).toEqual("A");
    back(1);
    // An in-between (at end) insertion point
    expect(nav.cursor.toString()).toEqual("AFTER 0/2");
    back(1);
    expect(nav.cursor.toString()).toEqual("AFTER 0/2/0");
    expect(nav.tip.node).toEqual("d");
    back(1);
    expect(nav.cursor.toString()).toEqual("BEFORE 0/2/0");
    expect(nav.tip.node).toEqual("d");
    back(1);

    // An in-between insertion point
    expect(nav.cursor.toString()).toEqual("AFTER 0/1");
    back(1);
    expect(nav.cursor.toString()).toEqual("AFTER 0/1/2");
    expect(nav.tip.node).toEqual("c");
    back(3);
    expect(nav.cursor.toString()).toEqual("BEFORE 0/1/0");
    expect(nav.tip.node).toEqual("a");
    back(1);
    // An in-between insertion point
    expect(nav.cursor.toString()).toEqual("AFTER 0/0");
    back(1);
    expect(nav.cursor.toString()).toEqual("ON 0/0");
    back(1);
    expect(nav.cursor.toString()).toEqual("BEFORE 0/0");

    expect(nav.navigateToPrecedingCursorPosition()).toBeFalsy();
  });
});
