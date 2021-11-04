import { Header, Hyperlink, Node, Paragraph, Span } from "../../src/document-model-rd5";
import { CursorNavigator } from "../../src/traversal-rd4";

import { CursorNavigatorTestUtils } from "./cursorNavigator.testUtils";

describe("navigateToNextCursorPosition", () => {
  const nextPrime = (nav: CursorNavigator, n: number) => {
    for (let i = 0; i < n; i++) {
      expect(nav.navigateToNextCursorPosition()).toBe(true);
    }
  };

  describe("goes through core inline to inline scenarios", () => {
    it.each(CursorNavigatorTestUtils.coreScenariosForInlines.forNext)("%p", (input, output) => {
      const nav = new CursorNavigator(CursorNavigatorTestUtils.coreScenariosForInlines.parseConciseDescription(input));

      const paths = [];
      let i = 10;
      while (nav.navigateToNextCursorPosition()) {
        paths.push(nav.cursor.toString());
        i--;
        if (i === 0) {
          throw new Error("looks like an infinite loop");
        }
      }
      expect(paths).toEqual(CursorNavigatorTestUtils.coreScenariosForInlines.parseConciseExpectation(output));
    });
  });

  it("should navigate through graphemes in a basic doc", () => {
    const nav = new CursorNavigator(CursorNavigatorTestUtils.testDocs.basicDoc);
    const next = nextPrime.bind(undefined, nav);
    next(1);
    expect(nav.tip.node).toEqual("H");
    expect(nav.cursor.toString()).toEqual("BEFORE 0/0/0");
    next(1);
    expect(nav.tip.node).toEqual("H");
    expect(nav.cursor.toString()).toEqual("AFTER 0/0/0");
    next(1);
    expect(nav.tip.node).toEqual("e");
    next(5);
    expect(nav.tip.node).toEqual("1");
    next(1);
    expect(nav.cursor.toString()).toEqual("BEFORE 1/0/0");
    expect(nav.tip.node).toEqual("H");
    next(1);
    expect(nav.cursor.toString()).toEqual("AFTER 1/0/0");
    expect(nav.tip.node).toEqual("H");
    next(16);
    expect(nav.tip.node).toEqual("t");
    expect(nav.cursor.toString()).toEqual("AFTER 1/0/16");
    next(1);
    expect(nav.tip.node).toEqual("M");
    expect(nav.cursor.toString()).toEqual("AFTER 1/1/0");
    next(4);
    expect(nav.tip.node).toEqual("l");
    expect(nav.cursor.toString()).toEqual("AFTER 1/2/0");
    next(4);
    expect(nav.tip.node).toEqual("P");
    expect(nav.cursor.toString()).toEqual("BEFORE 2/0/0");
    next(11);
    expect(nav.tip.node).toEqual("2");
    expect(nav.cursor.toString()).toEqual("AFTER 2/0/10");
    next(1);
    expect(nav.cursor.toString()).toEqual("BEFORE 2/1/0");
    expect(nav.tip.node).toEqual("G");
    next(1);
    expect(nav.cursor.toString()).toEqual("AFTER 2/1/0");
    expect(nav.tip.node).toEqual("G");
    next(3);
    expect(nav.tip.node).toEqual("G");
    expect(nav.cursor.toString()).toEqual("AFTER 2/1/3");
    next(1);
    expect(nav.tip.node).toEqual("f");
    expect(nav.cursor.toString()).toEqual("BEFORE 2/2/0");
    next(14);
    expect(nav.tip.node).toEqual("e");
    expect(nav.cursor.toString()).toEqual("AFTER 2/2/13");

    expect(nav.navigateToNextCursorPosition()).toBeFalsy();
  });

  it("should navigate through empty insertion points", () => {
    const nav = new CursorNavigator(CursorNavigatorTestUtils.testDocs.basicDocWithEmptyInsertionPoints);
    const next = nextPrime.bind(undefined, nav);
    next(1);
    expect((nav.tip.node as Node).nodeType).toEqual(Paragraph); // of final sentence
    next(1);
    expect(nav.tip.node).toEqual("A");
    expect(nav.cursor.toString()).toEqual("BEFORE 1/0/0");
    next(1);
    expect(nav.tip.node).toEqual("A");
    expect(nav.cursor.toString()).toEqual("AFTER 1/0/0");
    next(1);
    expect((nav.tip.node as Node).nodeType).toEqual(Span);
    expect(nav.cursor.toString()).toEqual("ON 1/1");
    next(1);
    expect(nav.tip.node).toEqual("B");
    expect(nav.cursor.toString()).toEqual("BEFORE 1/2/0");
    next(1);
    expect(nav.tip.node).toEqual("B");
    expect(nav.cursor.toString()).toEqual("AFTER 1/2/0");
    next(1);
    expect((nav.tip.node as Node).nodeType).toEqual(Header);
    expect(nav.cursor.toString()).toEqual("ON 2");
    next(1);
    expect(nav.tip.node).toEqual("C");
    expect(nav.cursor.toString()).toEqual("BEFORE 3/0/0");
    next(1);
    expect(nav.tip.node).toEqual("C");
    expect(nav.cursor.toString()).toEqual("AFTER 3/0/0");

    expect(nav.navigateToNextCursorPosition()).toBeFalsy();
  });

  it("should navigate through between insertion points", () => {
    const nav = new CursorNavigator(CursorNavigatorTestUtils.testDocs.basicDocWithBetweenInsertionPoints);
    const next = nextPrime.bind(undefined, nav);
    next(1);
    expect((nav.tip.node as Node).nodeType).toEqual(Hyperlink);
    expect((nav.tip.node as Node).getFacet("url")).toEqual("g.com");
    expect(nav.cursor.toString()).toEqual("BEFORE 0/0");
    next(1);
    expect((nav.tip.node as Node).nodeType).toEqual(Hyperlink);
    expect((nav.tip.node as Node).getFacet("url")).toEqual("g.com");
    expect(nav.cursor.toString()).toEqual("ON 0/0");
    next(1);
    expect((nav.tip.node as Node).nodeType).toEqual(Hyperlink);
    expect((nav.tip.node as Node).getFacet("url")).toEqual("g.com");
    expect(nav.cursor.toString()).toEqual("AFTER 0/0");
    next(1);
    expect(nav.tip.node).toEqual("a");
    expect(nav.cursor.toString()).toEqual("BEFORE 0/1/0");
    next(3);
    expect(nav.tip.node).toEqual("c");
    expect(nav.cursor.toString()).toEqual("AFTER 0/1/2");
    next(1);
    expect((nav.tip.node as Node).nodeType).toEqual(Hyperlink);
    expect((nav.tip.node as Node).getFacet("url")).toEqual("h.com");
    expect(nav.cursor.toString()).toEqual("AFTER 0/1");
    next(1);
    expect(nav.tip.node).toEqual("d");
    expect(nav.cursor.toString()).toEqual("BEFORE 0/2/0");
    next(1);
    expect(nav.tip.node).toEqual("d");
    expect(nav.cursor.toString()).toEqual("AFTER 0/2/0");
    next(1);
    expect((nav.tip.node as Node).nodeType).toEqual(Hyperlink);
    expect((nav.tip.node as Node).getFacet("url")).toEqual("i.com");
    next(1);
    expect(nav.tip.node).toEqual("A");
    expect(nav.cursor.toString()).toEqual("BEFORE 1/0/0");
    next(1);
    expect(nav.tip.node).toEqual("A");
    expect(nav.cursor.toString()).toEqual("AFTER 1/0/0");
    next(1);
    expect(nav.tip.node).toEqual("B");
    expect(nav.cursor.toString()).toEqual("BEFORE 1/1/0");
    next(1);
    expect(nav.tip.node).toEqual("B");
    expect(nav.cursor.toString()).toEqual("AFTER 1/1/0");
    next(1);
    expect(nav.tip.node).toEqual("C");
    expect(nav.cursor.toString()).toEqual("BEFORE 1/2/0");
    next(1);
    expect(nav.tip.node).toEqual("C");
    expect(nav.cursor.toString()).toEqual("AFTER 1/2/0");
    next(1);
    expect(nav.tip.node).toEqual("D");
    expect(nav.cursor.toString()).toEqual("BEFORE 2/0/0");
    next(1);
    expect(nav.tip.node).toEqual("D");
    expect(nav.cursor.toString()).toEqual("AFTER 2/0/0");

    expect(nav.navigateToNextCursorPosition()).toBeFalsy();
  });
});
