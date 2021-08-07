import { CursorOrientation } from "../../src/cursor";
import { Editor, FlowDirection, OPS } from "../../src/editor";
import { HeaderLevel } from "../../src/models";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { Before, After } = CursorOrientation;
const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugCurrentBlock = DebugEditorHelpers.debugCurrentBlock;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1", { italic: true })),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"), inlineText("DD"))
);
const testDoc2 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"), inlineText("DD"))
);

describe("joinOps for a single interactor", () => {
  describe("backwards", () => {
    it("basically works", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "1/2/0", orientation: After } }));
      editor.execute(OPS.joinBlocks({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/3/0 |>
SLICE:  HEADER ONE > TEXT {} > "NN"`);
      expect(debugCurrentBlock(editor)).toEqual(`
HEADER ONE > TEXT {ITALIC} > "H1"
HEADER ONE > TEXT {} > "MM"
HEADER ONE > TEXT {} > ""
HEADER ONE > TEXT {} > "NN"
HEADER ONE > TEXT {} > "AA"
HEADER ONE > TEXT {BOLD} > "BB"`);
    });

    it("handles the first block of the document ok (no-op)", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "0", orientation: Before } }));
      editor.execute(OPS.joinBlocks({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0/0
SLICE:  HEADER ONE > TEXT {ITALIC} > "H1"`);
      expect(debugCurrentBlock(editor)).toEqual(`
HEADER ONE > TEXT {ITALIC} > "H1"`);
    });

    it("works with empty blocks", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "2", orientation: After } }));
      editor.execute(OPS.joinBlocks({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/4/1 |>
SLICE:  PARAGRAPH > TEXT {BOLD} > "BB"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "NN"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"`);
    });

    it("merges compatible inline texts", () => {
      let editor = new Editor({ document: testDoc2 });
      editor.execute(OPS.jump({ to: { path: "1/2/0", orientation: After } }));
      editor.execute(OPS.joinBlocks({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/2/0 |>
SLICE:  HEADER ONE > TEXT {} > "NN"`);
      expect(debugCurrentBlock(editor)).toEqual(`
HEADER ONE > TEXT {} > "H1MM"
HEADER ONE > TEXT {} > ""
HEADER ONE > TEXT {} > "NN"
HEADER ONE > TEXT {} > "AA"
HEADER ONE > TEXT {BOLD} > "BB"`);

      editor = new Editor({
        document: doc(paragraph(inlineText("", { bold: true })), paragraph(inlineText("AA"))),
      });
      editor.execute(OPS.jump({ to: { path: "1/0/0", orientation: After } }));
      editor.execute(OPS.joinBlocks({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "AA"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "AA"`);
    });
  });

  describe("forwards", () => {
    it("basically works", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "0/0/1", orientation: After } }));
      editor.execute(OPS.joinBlocks({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  PARAGRAPH > TEXT {ITALIC} > "H1"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {ITALIC} > "H1"
PARAGRAPH > TEXT {} > "MM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "NN"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"`);
    });

    it("handles the last block of the document ok (no-op)", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "3/0/0", orientation: Before } }));
      editor.execute(OPS.joinBlocks({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 3/0/0
SLICE:  PARAGRAPH > TEXT {} > "CC"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "CC"
PARAGRAPH > URL_LINK g.com > "GOOGLE"
PARAGRAPH > TEXT {} > "DD"`);
    });

    it("works with empty blocks", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "2", orientation: After } }));
      editor.execute(OPS.joinBlocks({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 2/0/0
SLICE:  PARAGRAPH > TEXT {} > "CC"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "CC"
PARAGRAPH > URL_LINK g.com > "GOOGLE"
PARAGRAPH > TEXT {} > "DD"`);
    });

    it("merges compatible inline texts", () => {
      let editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "1/2/0", orientation: After } }));
      editor.execute(OPS.joinBlocks({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/2/0 |>
SLICE:  PARAGRAPH > TEXT {} > "NN"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "NN"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"`);

      editor = new Editor({
        document: doc(paragraph(inlineText("", { bold: true })), paragraph(inlineText("AA"))),
      });
      editor.execute(OPS.jump({ to: { path: "0/0", orientation: Before } }));
      editor.execute(OPS.joinBlocks({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0/0
SLICE:  PARAGRAPH > TEXT {} > "AA"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "AA"`);
    });
  });
});
