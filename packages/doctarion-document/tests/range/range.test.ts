import { Chain, Path } from "../../src/basic-traversal";
import { HeaderLevel } from "../../src/models";
import { Range } from "../../src/range";
import { doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H12")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN")),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"))
);

test("getMostAncestorialElementsInRange", () => {
  const check = (s1: string, s2: string) => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const p = Path.parse;
    const f = (results: readonly Chain[]) => results.map((chain) => chain.path.toString());
    const r = new Range(p(s1), p(s2)).getChainsCoveringRange(testDoc1);
    if (r) {
      return f(r);
    }
    return undefined;
  };

  expect(check("0/0/0", "0/0/0")).toEqual(["0/0/0"]);
  expect(check("0/0/0", "0/0/1")).toEqual(["0/0/0", "0/0/1"]);
  expect(check("0/0/1", "0/0/2")).toEqual(["0/0/1", "0/0/2"]);
  expect(check("0/0/0", "0/0/2")).toEqual(["0"]);
  expect(check("0/0/2", "1/0/0")).toEqual(["0/0/2", "1/0/0"]);
  expect(check("0/0", "1/0/0")).toEqual(["0", "1/0/0"]);
  expect(check("1/0/0", "1/0/1")).toEqual(["1/0"]);
  expect(check("1/0", "1/1")).toEqual(["1/0", "1/1"]);
  expect(check("1/0", "1/2")).toEqual(["1"]);
  expect(check("0/0", "3/1/3")).toEqual(["0", "1", "2", "3/0", "3/1/0", "3/1/1", "3/1/2", "3/1/3"]);
  expect(check("0", "2")).toEqual(["0", "1", "2"]);
  expect(check("2", "3")).toEqual(["2", "3"]);
  expect(check("2", "3/1/3")).toEqual(["2", "3/0", "3/1/0", "3/1/1", "3/1/2", "3/1/3"]);
  expect(check("0", "3")).toEqual([""]);
  expect(check("0/0/0", "3/1/5")).toEqual([""]);
});
