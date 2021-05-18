import { Path } from "../../src";
import { Cursor, CursorOrientation } from "../../src/cursor/cursor";
import { SimpleComparison } from "../../src/miscUtils";

// const testDoc1 = doc(
//   header(HeaderLevel.One, inlineText("Header1")),
//   paragraph(inlineText("Here is some text"), inlineText("MORE"), inlineText("last")),
//   paragraph(inlineText("Paragraph 2"), inlineUrlLink("http://google.com", "GOOG"), inlineText("final sentence"))
// );

const compareToScenarios = [
  ["BEFORE 1/1/0", "AFTER 1/1/1", SimpleComparison.Before],
  ["AFTER 1/1/1", "BEFORE 1/1/0", SimpleComparison.After],
  ["AFTER 1/1/0", "BEFORE 1/1/1", SimpleComparison.Before],
  ["BEFORE 1/1/0", "BEFORE 1/1/0", SimpleComparison.Equal],
  ["ON 1/1/0", "AFTER 1/1/0", SimpleComparison.After],
  ["BEFORE 1/1/0", "AFTER 1/1/0", SimpleComparison.After],
  ["AFTEr 1/1/0", "BEFORE 1/1/0", SimpleComparison.Before],
  ["ON 1/1", "BEFORE 1/1/0", SimpleComparison.After],
  ["ON 1/1", "AFTER 1/1/1", SimpleComparison.After],
  ["ON 1/1", "AFTER 1/1", SimpleComparison.After],
  ["ON 1/1", "BEFORE 1/1", SimpleComparison.Before],
  ["ON 1/1", "ON 1/2", SimpleComparison.Before],
  ["ON 1", "ON 1", SimpleComparison.Equal],
];

describe("compareTo", () => {
  it.each(compareToScenarios)("%p with %p should be %p", (leftSpec, rightSpec, result) => {
    const leftParts = leftSpec.split(" ");
    const leftOrientation = leftParts[0] as CursorOrientation;
    const left = new Cursor(Path.parse(leftParts[1]), leftOrientation);

    const rightParts = rightSpec.split(" ");
    const rightOrientation = rightParts[0] as CursorOrientation;
    const right = new Cursor(Path.parse(rightParts[1]), rightOrientation);
    expect(left.compareTo(right)).toBe(result);
  });
});
