import { Chain, NodeLayoutReporter, NodeNavigator } from "../../src";
import { CursorOrientation } from "../../src/cursor/cursor";
import { CursorNavigator } from "../../src/cursor/cursorNavigator";
import { HeaderLevel, NodeUtils } from "../../src/models";
import {
  debugCursorNavigator,
  debugCursorNavigator2,
  doc,
  header,
  inlineText,
  inlineUrlLink,
  paragraph,
} from "../utils";

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("Header1")),
  paragraph(inlineText("Here is some text"), inlineText("MORE"), inlineText("last")),
  paragraph(inlineText("Paragraph 2"), inlineUrlLink("http://google.com", "GOOG"), inlineText("final sentence"))
);

// Has empty insertion points
const testDoc2 = doc(
  paragraph(),
  paragraph(inlineText("A"), inlineText(""), inlineText("B")),
  header(HeaderLevel.One),
  paragraph(inlineText("C"))
);

// Has between insertion points
const testDoc3 = doc(
  paragraph(inlineUrlLink("g.com", ""), inlineUrlLink("h.com", "abc"), inlineUrlLink("i.com", "d")),
  paragraph(inlineText("A"), inlineUrlLink("j.com", "B"), inlineText("C")),
  paragraph(inlineText("D"))
);

// For use with line wrapping (3 chars per line)
const testDoc4 = doc(
  paragraph(
    inlineText("ABCDE"), // LINE 1 + 2
    inlineText("FGHI"), // LINE 2 + 3 (EOL 3)
    inlineText("JK"), // LINE 4
    inlineUrlLink("g.com", "LMNO"), // LINE 4 + 5 (EOL 5)
    inlineUrlLink("g.com", "PQR"), // LINE 6 (EOL 6)
    inlineText("STU"), // LINE 7
    inlineUrlLink("g.com", "VWX") // LINE 8
  )
);

class TestDoc4LayoutReporter implements NodeLayoutReporter {
  detectHorizontalDistanceFromTargetHorizontalAnchor(): never {
    throw new Error("Method not implemented.");
  }
  detectLineWrapOrBreakBetweenNodes(
    preceding: Chain | NodeNavigator,
    subsequent: Chain | NodeNavigator
  ): boolean | undefined {
    // Every three chars is a new line
    let inlineIndexToLine = (i: number) => i + 1;
    const line1 = NodeUtils.isGrapheme(preceding.tip.node)
      ? Math.floor((preceding.tip.node.toString().charCodeAt(0) - 65) / 3)
      : inlineIndexToLine(preceding.tip.pathPart.index);

    inlineIndexToLine = (i: number) => (i <= 1 ? i : i === 2 || i === 3 ? 3 : i + 1);
    const line2 = NodeUtils.isGrapheme(subsequent.tip.node)
      ? Math.floor((subsequent.tip.node.toString().charCodeAt(0) - 65) / 3)
      : inlineIndexToLine(subsequent.tip.pathPart.index);

    // console.log(preceding.tip, subsequent.tip, line1, line2);
    return line1 !== line2;
  }
  getTargetHorizontalAnchor(): never {
    throw new Error("Method not implemented.");
  }
}

const coreInlineToInlineScenariosForNext = [
  ["A", "00<,00>"],
  ["B", "0N"],
  ["C", "0<,00<,00>,0>"],
  ["D", "0<,0N,0>"],
  ["A,A", "00<,00>,10>"],
  ["A,B", "00<,00>,1N"],
  ["B,A", "0N,10<,10>"],
  ["B,B", "0N,1N"],
  ["C,A", "0<,00<,00>,10<,10>"],
  ["A,C", "00<,00>,10<,10>,1>"],
  ["C,B", "0<,00<,00>,1N"],
  ["B,C", "0N,10<,10>,1>"],
  ["C,C", "0<,00<,00>,0>,10<,10>,1>"],
  ["D,A", "0<,0N,10<,10>"],
  ["A,D", "00<,00>,1N,1>"],
  ["D,B", "0<,0N,1N"],
  ["B,D", "0N,1N,1>"],
  ["D,C", "0<,0N,0>,10<,10>,1>"],
  ["C,D", "0<,00<,00>,0>,1N,1>"],
  ["D,D", "0<,0N,0>,1N,1>"],
];

const coreInlineToInlineScenariosForPreceding = coreInlineToInlineScenariosForNext.map(([desc, excp]) => [
  desc,
  excp.split(",").reverse().join(","),
]);

const TestHelpers = {
  parseConciseDescription(d: string) {
    return d.split(",").map((c) => {
      if (c === "A") {
        return inlineText("A");
      } else if (c === "B") {
        return inlineText("");
      } else if (c === "C") {
        return inlineUrlLink("c.com", "C");
      } else if (c === "D") {
        return inlineUrlLink("d.com", "");
      } else {
        throw new Error("Bad concise test description");
      }
    });
  },

  parseConciseExpectation(s: string) {
    return s.split(",").map((s2) => {
      let r = "";
      let orientation = "";
      if (s2.length === 3) {
        const [contentIndex, cpIndex] = s2;
        orientation = s2[2];
        r = `0/${contentIndex}/${cpIndex}`;
      } else if (s2.length === 2) {
        const contentIndex = s2[0];
        orientation = s2[1];
        r = `0/${contentIndex}`;
      }
      if (orientation === "<") {
        return "<| " + r;
      } else if (orientation === ">") {
        return r + " |>";
      } else {
        return r;
      }
    });
  },
};

describe("navigateTo", () => {
  it("navigates to graphemes in a fleshed out doc", () => {
    const nav = new CursorNavigator(testDoc1);
    nav.navigateTo("1/1/2", CursorOrientation.After);
    expect(debugCursorNavigator(nav)).toEqual("1/1/2 |>");
    expect(nav.tip.node).toEqual("R");

    nav.navigateTo("0/0/0", CursorOrientation.Before);
    expect(debugCursorNavigator(nav)).toEqual("<| 0/0/0");
    expect(nav.tip.node).toEqual("H");

    nav.navigateTo("2/2/0", CursorOrientation.Before);
    expect(debugCursorNavigator(nav)).toEqual("<| 2/2/0");
    expect(nav.tip.node).toEqual("f");

    nav.navigateTo("2/2/13", CursorOrientation.After);
    expect(debugCursorNavigator(nav)).toEqual("2/2/13 |>");
    expect(nav.tip.node).toEqual("e");

    // Note that orientation is not honored in some cases
    nav.navigateTo("2/2/0", CursorOrientation.Before);
    expect(debugCursorNavigator(nav)).toEqual("<| 2/2/0");
    expect(nav.tip.node).toEqual("f");

    const nav2 = new CursorNavigator(doc(paragraph(inlineText("A"), inlineUrlLink("a.com", ""), inlineText("B"))));
    nav2.navigateTo("0/2/0", CursorOrientation.Before);
    expect(nav2.tip.node).toEqual("B");
  });

  it("navigates to graphemes and changes orientation in some cases", () => {
    const nav = new CursorNavigator(testDoc1);
    expect(nav.navigateTo("2/2/3", CursorOrientation.Before)).toBeTruthy();
    expect(debugCursorNavigator(nav)).toEqual("2/2/2 |>");
    expect(nav.tip.node).toEqual("n");

    expect(nav.navigateTo("1/1/0", CursorOrientation.Before)).toBeTruthy();
    expect(debugCursorNavigator(nav)).toEqual("1/0/16 |>");
    expect(nav.tip.node).toEqual("t");
  });

  it("navigates to empty insertion points", () => {
    const nav = new CursorNavigator(testDoc2);
    expect(nav.navigateTo("0", CursorOrientation.On)).toBeTruthy();
    expect(debugCursorNavigator(nav)).toEqual("0");

    expect(nav.navigateTo("1/1", CursorOrientation.On)).toBeTruthy();
    expect(debugCursorNavigator(nav)).toEqual("1/1");

    expect(nav.navigateTo("2", CursorOrientation.On)).toBeTruthy();
    expect(debugCursorNavigator(nav)).toEqual("2");
  });

  it("navigates to between insertion points", () => {
    const nav = new CursorNavigator(testDoc3);

    expect(nav.navigateTo("0/0", CursorOrientation.Before)).toBeTruthy();
    expect(debugCursorNavigator(nav)).toEqual("<| 0/0");
    expect(nav.navigateTo("0/0", CursorOrientation.After)).toBeTruthy();
    expect(debugCursorNavigator(nav)).toEqual("0/0 |>");
    expect(nav.navigateTo("0/1", CursorOrientation.Before)).toBeTruthy();
    // Note the change because the navigator prefers after orientation to before orientation
    expect(debugCursorNavigator(nav)).toEqual("0/0 |>");
    expect(nav.navigateTo("0/2", CursorOrientation.Before)).toBeTruthy();
    // Note the change because the navigator prefers after orientation to before orientation
    expect(debugCursorNavigator(nav)).toEqual("0/1 |>");
    expect(nav.navigateTo("0/2", CursorOrientation.After)).toBeTruthy();
    expect(debugCursorNavigator(nav)).toEqual("0/2 |>");
  });

  it("autocorrects navigation in some cases", () => {
    const nav = new CursorNavigator(doc(paragraph(inlineText("ASD"), inlineUrlLink("g.com", ""))));
    nav.navigateTo("0/1", CursorOrientation.Before);
    expect(debugCursorNavigator(nav)).toEqual("0/0/2 |>");
  });
});

describe("navigateToNextCursorPosition", () => {
  const nextPrime = (nav: CursorNavigator, n: number) => {
    for (let i = 0; i < n; i++) {
      expect(nav.navigateToNextCursorPosition()).toBe(true);
    }
  };

  describe("goes through core inline to inline scenarios", () => {
    it.each(coreInlineToInlineScenariosForNext)("%p", (input, output) => {
      const nav = new CursorNavigator(doc(paragraph(...TestHelpers.parseConciseDescription(input))));

      const paths = [];
      let i = 10;
      while (nav.navigateToNextCursorPosition()) {
        paths.push(debugCursorNavigator(nav));
        i--;
        if (i === 0) {
          throw new Error("looks like an infinite loop");
        }
      }
      expect(paths).toEqual(TestHelpers.parseConciseExpectation(output));
    });
  });

  it("should navigate through graphemes", () => {
    const nav = new CursorNavigator(testDoc1);
    const next = nextPrime.bind(undefined, nav);
    next(1);
    expect(nav.tip.node).toEqual("H");
    expect(debugCursorNavigator(nav)).toEqual("<| 0/0/0");
    next(1);
    expect(nav.tip.node).toEqual("H");
    expect(debugCursorNavigator(nav)).toEqual("0/0/0 |>");
    next(1);
    expect(nav.tip.node).toEqual("e");
    next(5);
    expect(nav.tip.node).toEqual("1");
    next(1);
    expect(debugCursorNavigator(nav)).toEqual("<| 1/0/0");
    expect(nav.tip.node).toEqual("H");
    next(1);
    expect(debugCursorNavigator(nav)).toEqual("1/0/0 |>");
    expect(nav.tip.node).toEqual("H");
    next(16);
    expect(nav.tip.node).toEqual("t");
    expect(debugCursorNavigator(nav)).toEqual("1/0/16 |>");
    next(1);
    expect(nav.tip.node).toEqual("M");
    expect(debugCursorNavigator(nav)).toEqual("1/1/0 |>");
    next(4);
    expect(nav.tip.node).toEqual("l");
    expect(debugCursorNavigator(nav)).toEqual("1/2/0 |>");
    next(4);
    expect(nav.tip.node).toEqual("P");
    expect(debugCursorNavigator(nav)).toEqual("<| 2/0/0");
    next(11);
    expect(nav.tip.node).toEqual("2");
    expect(debugCursorNavigator(nav)).toEqual("2/0/10 |>");
    next(1);
    expect(debugCursorNavigator(nav)).toEqual("<| 2/1/0");
    expect(nav.tip.node).toEqual("G");
    next(1);
    expect(debugCursorNavigator(nav)).toEqual("2/1/0 |>");
    expect(nav.tip.node).toEqual("G");
    next(3);
    expect(nav.tip.node).toEqual("G");
    expect(debugCursorNavigator(nav)).toEqual("2/1/3 |>");
    next(1);
    expect(nav.tip.node).toEqual("f");
    expect(debugCursorNavigator(nav)).toEqual("<| 2/2/0");
    next(14);
    expect(nav.tip.node).toEqual("e");
    expect(debugCursorNavigator(nav)).toEqual("2/2/13 |>");

    expect(nav.navigateToNextCursorPosition()).toBeFalsy();
  });

  it("should navigate through empty insertion points", () => {
    const nav = new CursorNavigator(testDoc2);
    const next = nextPrime.bind(undefined, nav);
    next(1);
    expect(nav.tip.node).toEqual(paragraph()); // of final sentence
    next(1);
    expect(nav.tip.node).toEqual("A");
    expect(debugCursorNavigator(nav)).toEqual("<| 1/0/0");
    next(1);
    expect(nav.tip.node).toEqual("A");
    expect(debugCursorNavigator(nav)).toEqual("1/0/0 |>");
    next(1);
    expect(nav.tip.node).toEqual(inlineText(""));
    expect(debugCursorNavigator(nav)).toEqual("1/1");
    next(1);
    expect(nav.tip.node).toEqual("B");
    expect(debugCursorNavigator(nav)).toEqual("<| 1/2/0");
    next(1);
    expect(nav.tip.node).toEqual("B");
    expect(debugCursorNavigator(nav)).toEqual("1/2/0 |>");
    next(1);
    expect(nav.tip.node).toEqual(header(HeaderLevel.One));
    expect(debugCursorNavigator(nav)).toEqual("2");
    next(1);
    expect(nav.tip.node).toEqual("C");
    expect(debugCursorNavigator(nav)).toEqual("<| 3/0/0");
    next(1);
    expect(nav.tip.node).toEqual("C");
    expect(debugCursorNavigator(nav)).toEqual("3/0/0 |>");

    expect(nav.navigateToNextCursorPosition()).toBeFalsy();
  });

  it("should navigate through between insertion points", () => {
    const nav = new CursorNavigator(testDoc3);
    // TODO deal with naviginat thorugh empty inline url link at start of firs tblock
    const next = nextPrime.bind(undefined, nav);
    next(1);
    expect(nav.tip.node).toEqual(inlineUrlLink("g.com", ""));
    expect(debugCursorNavigator(nav)).toEqual("<| 0/0");
    next(1);
    expect(nav.tip.node).toEqual(inlineUrlLink("g.com", ""));
    expect(debugCursorNavigator(nav)).toEqual("0/0");
    next(1);
    expect(nav.tip.node).toEqual(inlineUrlLink("g.com", ""));
    expect(debugCursorNavigator(nav)).toEqual("0/0 |>");
    next(1);
    expect(nav.tip.node).toEqual("a");
    expect(debugCursorNavigator(nav)).toEqual("<| 0/1/0");
    next(3);
    expect(nav.tip.node).toEqual("c");
    expect(debugCursorNavigator(nav)).toEqual("0/1/2 |>");
    next(1);
    expect(nav.tip.node).toEqual(inlineUrlLink("h.com", "abc"));
    expect(debugCursorNavigator(nav)).toEqual("0/1 |>");
    next(1);
    expect(nav.tip.node).toEqual("d");
    expect(debugCursorNavigator(nav)).toEqual("<| 0/2/0");
    next(1);
    expect(nav.tip.node).toEqual("d");
    expect(debugCursorNavigator(nav)).toEqual("0/2/0 |>");
    next(1);
    expect(nav.tip.node).toEqual(inlineUrlLink("i.com", "d"));
    next(1);
    expect(nav.tip.node).toEqual("A");
    expect(debugCursorNavigator(nav)).toEqual("<| 1/0/0");
    next(1);
    expect(nav.tip.node).toEqual("A");
    expect(debugCursorNavigator(nav)).toEqual("1/0/0 |>");
    next(1);
    expect(nav.tip.node).toEqual("B");
    expect(debugCursorNavigator(nav)).toEqual("<| 1/1/0");
    next(1);
    expect(nav.tip.node).toEqual("B");
    expect(debugCursorNavigator(nav)).toEqual("1/1/0 |>");
    next(1);
    expect(nav.tip.node).toEqual("C");
    expect(debugCursorNavigator(nav)).toEqual("<| 1/2/0");
    next(1);
    expect(nav.tip.node).toEqual("C");
    expect(debugCursorNavigator(nav)).toEqual("1/2/0 |>");
    next(1);
    expect(nav.tip.node).toEqual("D");
    expect(debugCursorNavigator(nav)).toEqual("<| 2/0/0");
    next(1);
    expect(nav.tip.node).toEqual("D");
    expect(debugCursorNavigator(nav)).toEqual("2/0/0 |>");

    expect(nav.navigateToNextCursorPosition()).toBeFalsy();
  });

  it("should navigate through line breaks nicely", () => {
    const nav = new CursorNavigator(testDoc4, new TestDoc4LayoutReporter());
    const next = nextPrime.bind(undefined, nav);
    next(1);
    expect(nav.tip.node).toEqual("A");
    expect(debugCursorNavigator(nav)).toEqual("<| 0/0/0");
    next(1);
    expect(nav.tip.node).toEqual("A");
    expect(debugCursorNavigator(nav)).toEqual("0/0/0 |>");
    next(2); // Wrap line, skip C
    expect(nav.tip.node).toEqual("D");
    expect(debugCursorNavigator(nav)).toEqual("<| 0/0/3");
    next(2);
    expect(nav.tip.node).toEqual("E");
    expect(debugCursorNavigator(nav)).toEqual("0/0/4 |>");
    next(1); // Normally we'd move to the after position on F but since its at EOL we move one ahead
    expect(nav.tip.node).toEqual("G");
    expect(debugCursorNavigator(nav)).toEqual("<| 0/1/1");
    next(2);
    expect(nav.tip.node).toEqual("H");
    expect(debugCursorNavigator(nav)).toEqual("0/1/2 |>");
    next(1); // Normally this would move to the last character but we move to the next inline because of the line wrap
    expect(nav.tip.node).toEqual("J");
    expect(debugCursorNavigator(nav)).toEqual("<| 0/2/0");
    next(2);
    expect(nav.tip.node).toEqual("K");
    expect(debugCursorNavigator(nav)).toEqual("0/2/1 |>");
    next(1);
    expect(nav.tip.node).toEqual("L");
    expect(debugCursorNavigator(nav)).toEqual("<| 0/3/0");
    next(1);
    expect(nav.tip.node).toEqual("M");
    expect(debugCursorNavigator(nav)).toEqual("<| 0/3/1");
    next(2);
    expect(nav.tip.node).toEqual("N");
    expect(debugCursorNavigator(nav)).toEqual("0/3/2 |>");
    next(1);
    expect(nav.tip.node).toEqual("O");
    expect(debugCursorNavigator(nav)).toEqual("0/3/3 |>");
    next(1);
    expect(nav.tip.node).toEqual(inlineUrlLink("g.com", "PQR"));
    expect(debugCursorNavigator(nav)).toEqual("<| 0/4");
    next(1);
    expect(nav.tip.node).toEqual("P");
    expect(debugCursorNavigator(nav)).toEqual("<| 0/4/0");
    next(2);
    expect(nav.tip.node).toEqual("Q");
    expect(debugCursorNavigator(nav)).toEqual("0/4/1 |>");
    next(1);
    expect(nav.tip.node).toEqual("R");
    expect(debugCursorNavigator(nav)).toEqual("0/4/2 |>");
    next(1);
    expect(nav.tip.node).toEqual("S");
    expect(debugCursorNavigator(nav)).toEqual("<| 0/5/0");
    next(2);
    expect(nav.tip.node).toEqual("T");
    expect(debugCursorNavigator(nav)).toEqual("0/5/1 |>");
    next(1);
    expect(nav.tip.node).toEqual("U");
    expect(debugCursorNavigator(nav)).toEqual("0/5/2 |>");
    next(1);
    expect(nav.tip.node).toEqual("V");
    expect(debugCursorNavigator(nav)).toEqual("<| 0/6/0");
    next(1);
    expect(nav.tip.node).toEqual("V");
    expect(debugCursorNavigator(nav)).toEqual("0/6/0 |>");
    next(2);
    expect(nav.tip.node).toEqual("X");
    expect(debugCursorNavigator(nav)).toEqual("0/6/2 |>");
  });
});

describe("navigateToPrecedingCursorPosition", () => {
  const backPrime = (nav: CursorNavigator, n: number) => {
    for (let i = 0; i < n; i++) {
      expect(nav.navigateToPrecedingCursorPosition()).toBe(true);
    }
  };

  describe("goes through core inline to inline scenarios", () => {
    it.each(coreInlineToInlineScenariosForPreceding)("%p", (input, output) => {
      const nav = new CursorNavigator(doc(paragraph(...TestHelpers.parseConciseDescription(input))));

      let i = 20;
      while (nav.navigateToNextCursorPosition()) {
        i--;
        if (i === 0) {
          throw new Error("looks like an infinite loop");
        }
      }

      const paths = [];
      paths.push(debugCursorNavigator(nav));

      while (nav.navigateToPrecedingCursorPosition()) {
        if (nav.chain.parent === undefined) {
          break;
        }
        paths.push(debugCursorNavigator(nav));
        i--;
        if (i === 0) {
          throw new Error("looks like an infinite loop");
        }
      }
      expect(paths).toEqual(TestHelpers.parseConciseExpectation(output));
    });
  });

  it("should navigate through graphemes", () => {
    const nav = new CursorNavigator(testDoc1);
    const back = backPrime.bind(undefined, nav);
    nav.navigateTo("2/2/1", CursorOrientation.After);
    expect(nav.tip.node).toEqual("i"); // of final sentence
    back(1);
    // Note this flips orientation intentionally as we always prefer after
    // orientation when possible
    expect(debugCursorNavigator(nav)).toEqual("2/2/0 |>");
    expect(nav.tip.node).toEqual("f");
    back(2);
    expect(nav.tip.node).toEqual("G"); // GOOG
    expect(debugCursorNavigator(nav)).toEqual("2/1/3 |>");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("2/1/2 |>");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("2/1/1 |>");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("2/1/0 |>");
    expect(nav.tip.node).toEqual("G");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("<| 2/1/0");
    expect(nav.tip.node).toEqual("G");
    back(1);
    expect(nav.tip.node).toEqual("2"); // Here is some text
    back(10);
    expect(nav.tip.node).toEqual("P");
    expect(debugCursorNavigator(nav)).toEqual("2/0/0 |>");
    back(2);
    expect(nav.tip.node).toEqual("t");
    expect(debugCursorNavigator(nav)).toEqual("1/2/3 |>");
    back(4);
    expect(nav.tip.node).toEqual("E");
    expect(debugCursorNavigator(nav)).toEqual("1/1/3 |>");
    back(4);
    expect(nav.tip.node).toEqual("t");
    expect(debugCursorNavigator(nav)).toEqual("1/0/16 |>");
    back(1);
    expect(nav.tip.node).toEqual("x");
    expect(debugCursorNavigator(nav)).toEqual("1/0/15 |>");
    back(14);
    expect(nav.tip.node).toEqual("e");
    expect(debugCursorNavigator(nav)).toEqual("1/0/1 |>");
    back(1);
    expect(nav.tip.node).toEqual("H"); // Here is some text
    expect(debugCursorNavigator(nav)).toEqual("1/0/0 |>");
    back(1);
    expect(nav.tip.node).toEqual("H"); // Here is some text
    expect(debugCursorNavigator(nav)).toEqual("<| 1/0/0");
    back(1);
    expect(nav.tip.node).toEqual("1"); // Header1
    expect(debugCursorNavigator(nav)).toEqual("0/0/6 |>");
    back(6);
    expect(nav.tip.node).toEqual("H");
    expect(debugCursorNavigator(nav)).toEqual("0/0/0 |>");
    back(1);
    expect(nav.tip.node).toEqual("H");
    expect(debugCursorNavigator(nav)).toEqual("<| 0/0/0");

    expect(nav.navigateToPrecedingCursorPosition()).toBeFalsy();
  });

  it("should navigate through empty insertion points", () => {
    const nav = new CursorNavigator(testDoc2);

    const back = backPrime.bind(undefined, nav);
    nav.navigateTo("3/0/0", CursorOrientation.Before);
    expect(nav.tip.node).toEqual("C"); // of final sentence
    back(1);
    expect(nav.tip.node).toEqual(header(HeaderLevel.One));
    expect(debugCursorNavigator(nav)).toEqual("2");
    back(1);
    expect(nav.tip.node).toEqual("B");
    expect(debugCursorNavigator(nav)).toEqual("1/2/0 |>");
    back(1);
    expect(nav.tip.node).toEqual("B");
    expect(debugCursorNavigator(nav)).toEqual("<| 1/2/0");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("1/1");
    expect(nav.tip.node).toEqual(inlineText(""));
    back(1);
    expect(nav.tip.node).toEqual("A");
    expect(debugCursorNavigator(nav)).toEqual("1/0/0 |>");
    back(1);
    expect(nav.tip.node).toEqual("A");
    expect(debugCursorNavigator(nav)).toEqual("<| 1/0/0");
    back(1);
    expect(nav.tip.node).toEqual(paragraph()); // Here is some text
    expect(debugCursorNavigator(nav)).toEqual("0");

    expect(nav.navigateToPrecedingCursorPosition()).toBeFalsy();
  });

  it("should navigate through between insertion points", () => {
    const nav = new CursorNavigator(testDoc3);
    const back = backPrime.bind(undefined, nav);
    nav.navigateTo("2/0/0", CursorOrientation.Before);
    expect(nav.tip.node).toEqual("D"); // of final sentence
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("1/2/0 |>");
    expect(nav.tip.node).toEqual("C");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("<| 1/2/0");
    expect(nav.tip.node).toEqual("C");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("1/1/0 |>");
    expect(nav.tip.node).toEqual("B");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("<| 1/1/0");
    expect(nav.tip.node).toEqual("B");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("1/0/0 |>");
    expect(nav.tip.node).toEqual("A");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("<| 1/0/0");
    expect(nav.tip.node).toEqual("A");
    back(1);
    // An in-between (at end) insertion point
    expect(debugCursorNavigator(nav)).toEqual("0/2 |>");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("0/2/0 |>");
    expect(nav.tip.node).toEqual("d");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("<| 0/2/0");
    expect(nav.tip.node).toEqual("d");
    back(1);

    // An in-between insertion point
    expect(debugCursorNavigator(nav)).toEqual("0/1 |>");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("0/1/2 |>");
    expect(nav.tip.node).toEqual("c");
    back(3);
    expect(debugCursorNavigator(nav)).toEqual("<| 0/1/0");
    expect(nav.tip.node).toEqual("a");
    back(1);
    // An in-between insertion point
    expect(debugCursorNavigator(nav)).toEqual("0/0 |>");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("0/0");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("<| 0/0");

    expect(nav.navigateToPrecedingCursorPosition()).toBeFalsy();
  });

  it("should navigate through line breaks nicely", () => {
    const nav = new CursorNavigator(testDoc4, new TestDoc4LayoutReporter());
    nav.navigateToLastDescendantCursorPosition();
    const back = backPrime.bind(undefined, nav);
    // Make sure we are starting at the end ;)
    expect(debugCursorNavigator2(nav)).toEqual(`0/6 |> :: URL_LINK g.com > "VWX"`);
    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("0/6/2 |> :: X");
    back(2);
    expect(debugCursorNavigator2(nav)).toEqual("0/6/0 |> :: V");
    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("<| 0/6/0 :: V");
    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("0/5/2 |> :: U");
    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("0/5/1 |> :: T");
    back(2);
    expect(debugCursorNavigator2(nav)).toEqual("<| 0/5/0 :: S");

    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("0/4/2 |> :: R");
    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("0/4/1 |> :: Q");
    back(2);
    expect(debugCursorNavigator2(nav)).toEqual("<| 0/4/0 :: P");
    back(1);
    expect(debugCursorNavigator2(nav)).toEqual(`<| 0/4 :: URL_LINK g.com > "PQR"`);

    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("0/3/3 |> :: O");
    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("0/3/2 |> :: N");
    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("0/3/1 |> :: M");
    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("<| 0/3/1 :: M");
    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("<| 0/3/0 :: L");

    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("0/2/1 |> :: K");
    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("0/2/0 |> :: J");
    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("<| 0/2/0 :: J");
    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("0/1/2 |> :: H");

    back(2);
    expect(debugCursorNavigator2(nav)).toEqual("<| 0/1/1 :: G");
    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("0/0/4 |> :: E");
    back(2);
    expect(debugCursorNavigator2(nav)).toEqual("<| 0/0/3 :: D");

    back(2);
    expect(debugCursorNavigator2(nav)).toEqual("0/0/0 |> :: A");
    back(1);
    expect(debugCursorNavigator2(nav)).toEqual("<| 0/0/0 :: A");
  });
});

describe("navigateToLastDescendantCursorPosition", () => {
  it("should handle empty insertion points", () => {
    const nav = new CursorNavigator(doc(paragraph(inlineText(""))));
    nav.navigateToUnchecked("0/0", CursorOrientation.After);
    nav.navigateToLastDescendantCursorPosition();
    expect(debugCursorNavigator(nav)).toEqual("0/0");
  });
});
