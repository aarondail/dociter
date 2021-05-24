import { Path, PathTreeMap, PathTreeMapChildNodePolcy } from "../../src/basic-traversal";

// eslint-disable-next-line @typescript-eslint/unbound-method
const p = Path.parse;

describe("add", () => {
  it("should work with child node policy ALLOW", () => {
    const pmt = new PathTreeMap<string>({ childNodesPolicy: PathTreeMapChildNodePolcy.ALLOW });

    pmt.add(p("0/1"), "test1");
    expect(pmt.hasPath(p("0/1"))).toBeTruthy();
    expect(pmt.hasPath(p("0"))).toBeFalsy();
    expect(pmt.getExact(p("0/1"))).toEqual(["test1"]);
    expect(pmt.getExact(p("0"))).toBeUndefined();
    pmt.add(p("0/2"), "test2");
    pmt.add(p("1/2/3"), "test3");
    pmt.add(p("1"), "test4");
    pmt.add(p("1/2"), "test5");
    expect(pmt.getExact(p("0/1"))).toEqual(["test1"]);
    expect(pmt.getExact(p("0/2"))).toEqual(["test2"]);
    expect(pmt.getExact(p("1"))).toEqual(["test4"]);
    expect(pmt.getExact(p("1/2"))).toEqual(["test5"]);
    expect(pmt.getExact(p("1/2/3"))).toEqual(["test3"]);
    pmt.add(p("0/1"), "test6");
    expect(pmt.getExact(p("0/1"))).toEqual(["test1", "test6"]);
  });

  it("should work with child node policy DROP", () => {
    const pmt = new PathTreeMap<string>({ childNodesPolicy: PathTreeMapChildNodePolcy.DROP });

    pmt.add(p("0/1"), "test1");
    expect(pmt.hasPath(p("0/1"))).toBeTruthy();
    expect(pmt.hasPath(p("0"))).toBeFalsy();
    expect(pmt.getExact(p("0/1"))).toEqual(["test1"]);
    expect(pmt.getExact(p("0"))).toBeUndefined();
    expect(pmt.getFlexible(p("0"))).toBeUndefined();
    pmt.add(p("0/2"), "test2");
    expect(pmt.getExact(p("0/2"))).toEqual(["test2"]);
    expect(pmt.getExact(p("0"))).toBeUndefined();
    pmt.add(p("0"), "test3");
    expect(pmt.getExact(p("0/1"))).toBeUndefined();
    expect(pmt.getExact(p("0/2"))).toBeUndefined();
    expect(pmt.getExact(p("0"))).toEqual(["test3"]);
    expect(pmt.getFlexible(p("0/1"))).toEqual(["test3"]);
    expect(pmt.getFlexible(p("0/1/1"))).toEqual(["test3"]);
  });

  it("should work with child node policy LIFT", () => {
    const pmt = new PathTreeMap<string>({ childNodesPolicy: PathTreeMapChildNodePolcy.LIFT });

    pmt.add(p("0/1"), "test1");
    expect(pmt.hasPath(p("0/1"))).toBeTruthy();
    expect(pmt.hasPath(p("0"))).toBeFalsy();
    expect(pmt.getExact(p("0/1"))).toEqual(["test1"]);
    expect(pmt.getExact(p("0"))).toBeUndefined();
    expect(pmt.getFlexible(p("0"))).toBeUndefined();
    pmt.add(p("0/2"), "test2");
    expect(pmt.getExact(p("0/2"))).toEqual(["test2"]);
    expect(pmt.getExact(p("0"))).toBeUndefined();
    pmt.add(p("0"), "test3");
    expect(pmt.getExact(p("0/1"))).toBeUndefined();
    expect(pmt.getExact(p("0/2"))).toBeUndefined();
    expect(pmt.getExact(p("0"))).toEqual(["test1", "test2", "test3"]);
    expect(pmt.getFlexible(p("0/1"))).toEqual(["test1", "test2", "test3"]);
    expect(pmt.getFlexible(p("0/1/1"))).toEqual(["test1", "test2", "test3"]);
  });
});
