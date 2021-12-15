import { TextStyleModifier, TextStyleStrip, WorkingTextStyleStrip } from "../../src";

function dumpModifier(modifier: TextStyleModifier): string {
  return JSON.stringify(modifier).replaceAll('"', "");
}
function dumpModifiers(strip: TextStyleStrip): string {
  return strip.modifiers.map((e) => `${e.graphemeIndex}: ${dumpModifier(e.modifier)}`).join("\n");
}

function dumpStyles(strip: WorkingTextStyleStrip): string {
  return strip.styles.map((e) => `${e.graphemeIndex}: ${dumpModifier(e.style)}`).join("\n");
}

describe("styleRange", () => {
  it("works in the most basic case", () => {
    const strip = new WorkingTextStyleStrip([], 10);
    strip.styleRange(5, 7, { bold: true });
    expect(dumpStyles(strip)).toMatchInlineSnapshot(`
      "5: {bold:true}
      8: {}"
    `);
    expect(dumpModifiers(strip)).toMatchInlineSnapshot(`
      "5: {bold:true}
      8: {bold:null}"
    `);
  });

  it("should add entries for overlapping styles", () => {
    const strip = new WorkingTextStyleStrip([], 20);
    strip.styleRange(5, 7, { bold: true });
    strip.styleRange(0, 9, { italic: true });
    expect(dumpModifiers(strip)).toMatchInlineSnapshot(`
      "0: {italic:true}
      5: {bold:true}
      8: {bold:null}
      10: {italic:null}"
    `);
    strip.styleRange(8, 12, { foregroundColor: "red" });
    strip.styleRange(2, 8, { backgroundColor: "blue" });

    expect(dumpModifiers(strip)).toMatchInlineSnapshot(`
      "0: {italic:true}
      2: {backgroundColor:blue}
      5: {bold:true}
      8: {bold:null,foregroundColor:red}
      9: {backgroundColor:null}
      10: {italic:null}
      13: {foregroundColor:null}"
    `);
    expect(dumpStyles(strip)).toMatchInlineSnapshot(`
      "0: {italic:true}
      2: {italic:true,backgroundColor:blue}
      5: {bold:true,italic:true,backgroundColor:blue}
      8: {italic:true,foregroundColor:red,backgroundColor:blue}
      9: {italic:true,foregroundColor:red}
      10: {foregroundColor:red}
      13: {}"
    `);
  });

  it("should be able to clear", () => {
    const strip = new WorkingTextStyleStrip([], 20);
    strip.styleRange(5, 7, { bold: true });
    strip.styleRange(0, 9, { italic: true });
    expect(dumpModifiers(strip)).toMatchInlineSnapshot(`
      "0: {italic:true}
      5: {bold:true}
      8: {bold:null}
      10: {italic:null}"
    `);

    strip.styleRange(2, 3, { bold: null });

    expect(dumpStyles(strip)).toMatchInlineSnapshot(`
      "0: {italic:true}
      5: {bold:true,italic:true}
      8: {italic:true}
      10: {}"
    `);
    expect(dumpModifiers(strip)).toMatchInlineSnapshot(`
      "0: {italic:true}
      5: {bold:true}
      8: {bold:null}
      10: {italic:null}"
    `);

    // Note: this results in some redundant styles which is unfortunate by ok
    // for now
    strip.styleRange(4, 6, { bold: null });

    expect(dumpStyles(strip)).toMatchInlineSnapshot(`
      "0: {italic:true}
      5: {italic:true}
      7: {bold:true,italic:true}
      8: {italic:true}
      10: {}"
    `);
    expect(dumpModifiers(strip)).toMatchInlineSnapshot(`
      "0: {italic:true}
      7: {bold:true}
      8: {bold:null}
      10: {italic:null}"
    `);
  });

  it("grapheme count should affect it", () => {
    const strip = new WorkingTextStyleStrip([], 5);
    strip.styleRange(5, 7, { bold: true });
    strip.styleRange(0, 9, { italic: true });
    expect(dumpModifiers(strip)).toMatchInlineSnapshot(`"0: {italic:true}"`);

    strip.styleRange(8, 12, { foregroundColor: "red" });
    strip.styleRange(2, 8, { backgroundColor: "blue" });
    expect(dumpModifiers(strip)).toMatchInlineSnapshot(`
      "0: {italic:true}
      2: {backgroundColor:blue}"
    `);
    expect(dumpStyles(strip)).toMatchInlineSnapshot(`
      "0: {italic:true}
      2: {italic:true,backgroundColor:blue}"
    `);
  });

  it("grapheme count should affect it when clearing", () => {
    const strip = new WorkingTextStyleStrip([], 10);
    strip.styleRange(5, 7, { bold: true });
    strip.styleRange(0, 9, { italic: true });
    expect(dumpModifiers(strip)).toMatchInlineSnapshot(`
      "0: {italic:true}
      5: {bold:true}
      8: {bold:null}"
    `);

    strip.styleRange(6, 12, { bold: null });

    expect(dumpModifiers(strip)).toMatchInlineSnapshot(`
      "0: {italic:true}
      5: {bold:true}
      6: {bold:null}"
    `);
    expect(dumpStyles(strip)).toMatchInlineSnapshot(`
      "0: {italic:true}
      5: {bold:true,italic:true}
      6: {italic:true}
      8: {italic:true}"
    `);
  });
});

describe("resolveStyleAt", () => {
  it("should work normally", () => {
    const strip = new WorkingTextStyleStrip([], 10);
    strip.styleRange(5, 7, { bold: true });
    strip.styleRange(0, 9, { italic: true });
    expect(dumpModifier(strip.getStyleAt(0)!)).toMatchInlineSnapshot(`"{italic:true}"`);
    expect(dumpModifier(strip.getStyleAt(5)!)).toMatchInlineSnapshot(`"{bold:true,italic:true}"`);
    expect(dumpModifier(strip.getStyleAt(9)!)).toMatchInlineSnapshot(`"{italic:true}"`);
  });
});

describe("clearRange", () => {
  it("works in the most basic case", () => {
    const strip = new WorkingTextStyleStrip([], 10);
    strip.styleRange(5, 7, { bold: true });

    strip.clearRange(0, 10);
    expect(dumpStyles(strip)).toMatchInlineSnapshot(`""`);
    expect(dumpModifiers(strip)).toMatchInlineSnapshot(`""`);
  });

  it("should add entries for overlapping styles", () => {
    const strip = new WorkingTextStyleStrip([], 20);
    strip.styleRange(5, 7, { bold: true });
    strip.styleRange(0, 9, { italic: true });
    strip.styleRange(8, 12, { foregroundColor: "red" });
    strip.styleRange(2, 8, { backgroundColor: "blue" });

    strip.clearRange(6, 10);
    expect(dumpModifiers(strip)).toMatchInlineSnapshot(`
      "0: {italic:true}
      2: {backgroundColor:blue}
      5: {bold:true}
      6: {bold:null,italic:null,backgroundColor:null}
      11: {foregroundColor:red}
      13: {foregroundColor:null}"
    `);
    expect(dumpStyles(strip)).toMatchInlineSnapshot(`
      "0: {italic:true}
      2: {italic:true,backgroundColor:blue}
      5: {bold:true,italic:true,backgroundColor:blue}
      6: {}
      11: {foregroundColor:red}
      13: {}"
    `);
  });
});

test("joinAppend", () => {
  const strip = new WorkingTextStyleStrip([{ graphemeIndex: 5, modifier: { bold: true } }], 7);
  strip.joinAppend(new WorkingTextStyleStrip([{ graphemeIndex: 0, modifier: { italic: true } }], 6));
  expect(dumpStyles(strip)).toMatchInlineSnapshot(`
    "5: {bold:true}
    7: {italic:true}"
  `);
  expect(dumpModifiers(strip)).toMatchInlineSnapshot(`
    "5: {bold:true}
    7: {bold:null,italic:true}"
  `);
  expect(strip.graphemeCount).toEqual(13);
});

test("joinPrepend", () => {
  const strip = new WorkingTextStyleStrip([{ graphemeIndex: 5, modifier: { bold: true } }], 7);
  strip.joinPrepend(new WorkingTextStyleStrip([{ graphemeIndex: 0, modifier: { italic: true } }], 3));
  expect(dumpStyles(strip)).toMatchInlineSnapshot(`
    "0: {italic:true}
    3: {}
    8: {bold:true}"
  `);
  expect(dumpModifiers(strip)).toMatchInlineSnapshot(`
    "0: {italic:true}
    3: {italic:null}
    8: {bold:true}"
  `);
  expect(strip.graphemeCount).toEqual(10);
});
