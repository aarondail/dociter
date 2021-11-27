import { CursorOrientation, CursorPath, Path, SimpleComparison } from "../../src";

const compareToScenarios = [
  ["BEFORE 1/1/0", "AFTER 1/1/1", SimpleComparison.Before],
  ["AFTER 1/1/1", "BEFORE 1/1/0", SimpleComparison.After],
  ["AFTER 1/1/0", "BEFORE 1/1/1", SimpleComparison.Before],
  ["BEFORE 1/1/0", "BEFORE 1/1/0", SimpleComparison.Equal],
  ["ON 1/1/0", "AFTER 1/1/0", SimpleComparison.Before],
  ["BEFORE 1/1/0", "AFTER 1/1/0", SimpleComparison.Before],
  ["AFTER 1/1/0", "BEFORE 1/1/0", SimpleComparison.After],
  ["ON 1/1", "BEFORE 1/1/0", SimpleComparison.Before],
  ["ON 1/1", "AFTER 1/1/1", SimpleComparison.Before],
  ["ON 1/1", "AFTER 1/1", SimpleComparison.Before],
  ["ON 1/1", "BEFORE 1/1", SimpleComparison.After],
  ["ON 1/1", "ON 1/2", SimpleComparison.Before],
  ["ON 1", "ON 1", SimpleComparison.Equal],
  ["BEFORE 3/1/1", "AFTER 1/0/0", SimpleComparison.After],
  ["AFTER 3/2/1", "BEFORE 3/2/1", SimpleComparison.After],
  ["BEFORE 3/2/1", "AFTER 3/2/1", SimpleComparison.Before],
  ["BEFORE 0/0", "AFTER 0/0/0", SimpleComparison.Before],
  ["AFTER 0/0", "AFTER 0/0/0", SimpleComparison.After],
  ["BEFORE 0/0", "BEFORE 0/0/0", SimpleComparison.Before],
  ["AFTER 0/0", "BEFORE 0/0/0", SimpleComparison.After],
];

describe("compareTo", () => {
  it.each(compareToScenarios)("%p with %p should be %p", (leftSpec, rightSpec, result) => {
    const leftParts = leftSpec.split(" ");
    const leftOrientation = leftParts[0] as CursorOrientation;
    const left = new CursorPath(Path.parse(leftParts[1]), leftOrientation);

    const rightParts = rightSpec.split(" ");
    const rightOrientation = rightParts[0] as CursorOrientation;
    const right = new CursorPath(Path.parse(rightParts[1]), rightOrientation);
    expect(left.compareTo(right)).toBe(result);
  });
});
