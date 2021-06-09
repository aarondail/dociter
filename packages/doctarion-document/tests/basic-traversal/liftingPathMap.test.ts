import { LiftingPathMap, Path } from "../../src/basic-traversal";

// eslint-disable-next-line @typescript-eslint/unbound-method
const p = Path.parse;

test("should add, get, and properly lift elements", () => {
  const pmt = new LiftingPathMap<string>();

  pmt.add(p("0/1"), "test1");
  expect(pmt.get(p("0/1"))?.elements).toEqual(["test1"]);
  expect(pmt.get(p("0/1"))?.liftedElements).toEqual([]);
  expect(pmt.get(p("0"))).toBeUndefined();
  pmt.add(p("0/2"), "test2");
  expect(pmt.get(p("0/2"))?.elements).toEqual(["test2"]);
  expect(pmt.get(p("0/2"))?.liftedElements).toEqual([]);
  expect(pmt.get(p("0"))).toBeUndefined();
  pmt.add(p("0"), "test3");
  expect(pmt.get(p("0/1"))).toBeUndefined();
  expect(pmt.get(p("0/2"))).toBeUndefined();
  expect(pmt.get(p("0"))?.elements).toEqual(["test3"]);
  expect(pmt.get(p("0"))?.liftedElements).toEqual(["test1", "test2"]);
});
