import { LiftingPathMap, Path } from "../../src/traversal";

// eslint-disable-next-line @typescript-eslint/unbound-method
const p = Path.parse;

test("should add, get, and properly lift elements", () => {
  const pmt = new LiftingPathMap<string>();

  pmt.add(p("0/1"), "test1");
  expect(pmt.get(p("0/1"))?.elements).toEqual(["test1"]);
  expect(pmt.get(p("0/1"))?.path.toString()).toEqual("0/1");
  expect(pmt.get(p("0/1"))?.liftedElements).toEqual([]);
  expect(pmt.get(p("0"))).toBeUndefined();
  pmt.add(p("0/2"), "test2");
  expect(pmt.get(p("0/2"))?.elements).toEqual(["test2"]);
  expect(pmt.get(p("0/2"))?.path.toString()).toEqual("0/2");
  expect(pmt.get(p("0/2"))?.liftedElements).toEqual([]);
  expect(pmt.get(p("0"))).toBeUndefined();
  pmt.add(p("0"), "test3");
  expect(pmt.get(p("0/1"))).toBeUndefined();
  expect(pmt.get(p("0/2"))).toBeUndefined();
  expect(pmt.get(p("0"))?.elements).toEqual(["test3"]);
  expect(pmt.get(p("0"))?.path.toString()).toEqual("0");
  expect(pmt.get(p("0"))?.liftedElements).toEqual(["test1", "test2"]);
});

test("getAllOrderedByPaths should return elements properly ordered", () => {
  const pmt = new LiftingPathMap<string>();

  pmt.add(p("0/1"), "A");
  pmt.add(p("0"), "B");
  pmt.add(p("0/2"), "C");

  pmt.add(p("3/0/1"), "D");
  pmt.add(p("2/0/4/1"), "E");
  pmt.add(p("2/0/4/1"), "E2");
  pmt.add(p("1"), "F");

  expect(
    pmt
      .getAllOrderedByPaths()
      .map((x) => x.elements.join(","))
      .join("|")
  ).toBe("B|F|E,E2|D");
});
