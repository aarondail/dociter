import { time } from "../src/index";

test("time > 0.2", () => {
  expect(time()).toBeGreaterThan(-0.2);
});
