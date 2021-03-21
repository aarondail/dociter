import { Chain, Path } from "../../src/basic-traversal";
import * as Models from "../../src/models";
import { Range } from "../../src/ranges";
import { doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const testDoc1 = doc(
  header(Models.HeaderLevel.One, inlineText("H12")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN")),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"))
);

test("getMostAncestorialElementsInRange", () => {
  const check = (s1: string, s2: string) => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const p = Path.parse;
    const f = (results: readonly Chain[]) => results.map((chain) => Path.toString(Chain.getPath(chain)));
    const r = Range.getChainsCoveringRange(testDoc1, Range.new(p(s1), p(s2)));
    if (r) {
      return f(r);
    }
    return undefined;
  };

  expect(check("block:0/content:0/cp:0", "block:0/content:0/cp:0")).toEqual(["block:0/content:0/cp:0"]);
  expect(check("block:0/content:0/cp:0", "block:0/content:0/cp:1")).toEqual([
    "block:0/content:0/cp:0",
    "block:0/content:0/cp:1",
  ]);
  expect(check("block:0/content:0/cp:1", "block:0/content:0/cp:2")).toEqual([
    "block:0/content:0/cp:1",
    "block:0/content:0/cp:2",
  ]);
  expect(check("block:0/content:0/cp:0", "block:0/content:0/cp:2")).toEqual(["block:0"]);
  expect(check("block:0/content:0/cp:2", "block:1/content:0/cp:0")).toEqual([
    "block:0/content:0/cp:2",
    "block:1/content:0/cp:0",
  ]);
  expect(check("block:0/content:0", "block:1/content:0/cp:0")).toEqual(["block:0", "block:1/content:0/cp:0"]);
  expect(check("block:1/content:0/cp:0", "block:1/content:0/cp:1")).toEqual(["block:1/content:0"]);
  expect(check("block:1/content:0", "block:1/content:1")).toEqual(["block:1/content:0", "block:1/content:1"]);
  expect(check("block:1/content:0", "block:1/content:2")).toEqual(["block:1"]);
  expect(check("block:0/content:0", "block:3/content:1/cp:3")).toEqual([
    "block:0",
    "block:1",
    "block:2",
    "block:3/content:0",
    "block:3/content:1/cp:0",
    "block:3/content:1/cp:1",
    "block:3/content:1/cp:2",
    "block:3/content:1/cp:3",
  ]);
  expect(check("block:0", "block:2")).toEqual(["block:0", "block:1", "block:2"]);
  expect(check("block:2", "block:3")).toEqual(["block:2", "block:3"]);
  expect(check("block:2", "block:3/content:1/cp:3")).toEqual([
    "block:2",
    "block:3/content:0",
    "block:3/content:1/cp:0",
    "block:3/content:1/cp:1",
    "block:3/content:1/cp:2",
    "block:3/content:1/cp:3",
  ]);
  expect(check("block:0", "block:3")).toEqual([""]);
  expect(check("block:0/content:0/cp:0", "block:3/content:1/cp:5")).toEqual([""]);
});
