/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { InlineText } from "doctarion-document";
import lodash from "lodash";

import { NodeLayoutProvider } from "../src";
import { NodeTextLayoutAnalyzer } from "../src/nodeTextLayoutAnalyzer";
import { buildGraphemeToCodeUnitMap } from "../src/utils";

// TESTS TO RUN

const tests = [test1, test2, test3, test4, test5, test6, test7];
// const tests = [test6];

// HELPER

const expector = (testName: string, resultElement: HTMLElement) => {
  resultElement.classList.remove("success");
  resultElement.classList.remove("failed");
  resultElement.textContent = "";

  function logSuccess(message: string) {
    if (!resultElement.classList.contains("failed")) {
      resultElement.classList.add("success");
    }
    resultElement.textContent += "\nSUCCESS: " + message;
  }
  function logFailed(message: string) {
    resultElement.classList.remove("success");
    resultElement.classList.add("failed");
    resultElement.textContent += "\nFAILED: " + message;
  }

  function equal(actual: any, expected: any, message?: string) {
    const result = lodash.isEqual(actual, expected);
    if (result) {
      logSuccess(message || "arguments equal");
    } else {
      console.warn(testName + " FAILED " + (message ?? ""), actual, "!==", expected);
      logFailed(message || "arguments not equal");
    }
  }

  function truthy(actual: any, message?: string) {
    if (actual) {
      logSuccess(message || "argument truthy");
    } else {
      logFailed(message || "argument falsey");
    }
  }

  return {
    equal,
    truthy,
  };
};

// TEST DEFINITINS
interface TestArgs {
  testName: string;
  el: HTMLElement;
  ex: ReturnType<typeof expector>;
  node: InlineText;
  provider: NodeLayoutProvider;
  ta: NodeTextLayoutAnalyzer;
}

function test1({ ex, ta }: TestArgs) {
  const layout = ta.getAllGraphemeLineWraps();
  ex.truthy(layout);
  ex.equal(layout?.size, 0);
}

function test2({ ta, ex }: TestArgs) {
  const layout = ta.getAllGraphemeLineWraps();
  ex.truthy(layout);
  ex.equal(layout?.size, 2);
}

function test3({ ta, ex }: TestArgs) {
  const layout = ta.getAllGraphemeLineWraps();
  ex.truthy(layout);
  ex.equal(layout?.size, 3);

  // debugHelper(ta);
}

function test4({ ta, ex }: TestArgs) {
  const layout = ta.getAllGraphemeLineWraps();
  ex.truthy(layout);
  ex.equal(layout?.size, 23);
  // debugHelper(ta);
}

function test5({ ta, ex }: TestArgs) {
  const layout = ta.getAllGraphemeLineWraps();
  ex.truthy(layout);
  ex.equal(layout?.size, 5);
  // debugHelper(ta);
}

function test6({ ta, ex }: TestArgs) {
  const layout = ta.getAllGraphemeLineWraps();
  ex.truthy(layout);
  ex.equal(layout?.size, 3);
  // debugHelper(ta);
}

function test7({ ta, provider, ex }: TestArgs) {
  const layout = ta.getAllGraphemeLineWraps();
  ex.truthy(layout);
  ex.truthy(provider.getDetailedLayout()?.length || 0 >= 3);
  ex.equal(layout?.size, 5);
  // debugHelper(ta);
}

// TEST RUNNER

for (const test of tests) {
  const testName = test.name;
  console.log("STARTING " + testName);
  const el = document.getElementById(testName)!;
  const elr = document.getElementById(testName + "r")!;
  const ex = expector(testName, elr);
  const node = new InlineText(el.textContent || "");
  const provider = new NodeLayoutProvider(el, node);
  const { codeUnitCount, map } = buildGraphemeToCodeUnitMap(node.text);
  const ta = new NodeTextLayoutAnalyzer(provider.getCodeUnitLayoutProvider(), {
    codeUnitCount,
    graphemeCount: node.text.length,
    graphemeToCodeUnitIndecies: map,
  });

  const args = {
    testName,
    el,
    ex,
    node,
    provider,
    ta,
  };

  console.time(testName);
  test(args);
  console.timeEnd(testName);
}

// OTHER HELPER

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function debugHelper(ta: NodeTextLayoutAnalyzer) {
  const rects = ta.getAllGraphemeRects() || [];
  const interestingGraphemes = ta.getAllGraphemeLineWraps();

  const colors = ["red", "green", "blue", "#B0F"];
  let i = 0;
  for (const r of rects) {
    if (!r) {
      i++;
      continue;
    }
    const interesting = interestingGraphemes?.has(i);
    const rect = document.createElement("div");
    const { left, top, width, height } = r;
    const color = interesting ? "orange" : colors[i % colors.length];
    const opacity = interesting ? "100%" : "40%";
    const borderSize = interesting ? "2px" : "2px";
    // if (!interesting) {
    //   i++;
    //   continue;
    // }
    rect.style.cssText = `
position: absolute; box-sizing: border-box; opacity: ${opacity};
left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px;
border: solid ${borderSize} ${color}; ${interesting ? "background-color: rgba(255,255,255,0.5); " : ""}`;
    document.body.appendChild(rect);
    i++;
  }
}
