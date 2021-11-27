import { TextStyleModifier, TextStyleStrip, WorkingTextStyleStrip } from "../../src";

function dumpModifier(modifier: TextStyleModifier): string {
  return JSON.stringify(modifier).replaceAll('"', "");
}
function dumpEntries(strip: TextStyleStrip): string {
  return strip.entries.map((e) => `${e.graphemeIndex}: ${dumpModifier(e.modifier)}`).join("\n");
}

describe("setModifier", () => {
  it("should sort entries", () => {
    const strip = new WorkingTextStyleStrip([]);
    strip.setModifier(6, { bold: true });
    strip.setModifier(10, { bold: null });
    strip.setModifier(0, { italic: true });
    strip.setModifier(2, { foregroundColor: "red" });
    expect(dumpEntries(strip)).toMatchInlineSnapshot(`
      "0: {italic:true}
      2: {foregroundColor:red}
      6: {bold:true}
      10: {bold:null}"
    `);
  });

  it("should merge entries", () => {
    const strip = new WorkingTextStyleStrip([]);
    strip.setModifier(6, { bold: true });
    strip.setModifier(10, { bold: null });
    strip.setModifier(10, { italic: true });
    expect(dumpEntries(strip)).toMatchInlineSnapshot(`
          "6: {bold:true}
          10: {bold:null,italic:true}"
      `);
  });

  it("should merge null entry", () => {
    const strip = new WorkingTextStyleStrip([]);
    strip.setModifier(6, { bold: true });
    strip.setModifier(6, { bold: null });
    expect(dumpEntries(strip)).toMatchInlineSnapshot(`"6: {}"`);
  });
});

describe("resolveStyleAt", () => {
  it("should work normally", () => {
    const strip = new WorkingTextStyleStrip([]);
    strip.setModifier(6, { bold: true });
    strip.setModifier(10, { bold: null });
    strip.setModifier(0, { italic: true });
    strip.setModifier(2, { foregroundColor: "red" });
    expect(dumpModifier(strip.resolveStyleAt(0))).toMatchInlineSnapshot(`"{italic:true}"`);
    expect(dumpModifier(strip.resolveStyleAt(5))).toMatchInlineSnapshot(`"{italic:true,foregroundColor:red}"`);
    expect(dumpModifier(strip.resolveStyleAt(9))).toMatchInlineSnapshot(
      `"{italic:true,foregroundColor:red,bold:true}"`
    );
    expect(dumpModifier(strip.resolveStyleAt(10))).toMatchInlineSnapshot(`"{italic:true,foregroundColor:red}"`);
    expect(dumpModifier(strip.resolveStyleAt(11))).toMatchInlineSnapshot(`"{italic:true,foregroundColor:red}"`);
  });
});

test("updateForAppend", () => {
  const strip = new WorkingTextStyleStrip([{ graphemeIndex: 5, modifier: { bold: true } }]);
  strip.updateForAppend(6, new TextStyleStrip({ graphemeIndex: 0, modifier: { italic: true } }));
  expect(dumpEntries(strip)).toMatchInlineSnapshot(`
    "5: {bold:true}
    6: {italic:true,bold:null}"
  `);
});

test("updateForPrepend", () => {
  const strip = new WorkingTextStyleStrip([{ graphemeIndex: 5, modifier: { bold: true } }]);
  strip.updateForPrepend(3, new TextStyleStrip({ graphemeIndex: 0, modifier: { italic: true } }));
  expect(dumpEntries(strip)).toMatchInlineSnapshot(`
    "0: {italic:true}
    3: {italic:null}
    8: {bold:true}"
  `);
});
