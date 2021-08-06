import { CursorOrientation } from "../../src/cursor";
import { Editor, FlowDirection, OPS } from "../../src/editor";
import { HeaderLevel } from "../../src/models";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { Before, After } = CursorOrientation;
const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugCurrentBlock = DebugEditorHelpers.debugCurrentBlock;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"), inlineText("DD"))
);

describe("joinOps for a single selection interactor", () => {
  describe("backwards", () => {
    it("basically works", () => {
      const editor = new Editor({ document: testDoc1, omitDefaultInteractor: true });
      editor.execute(
        OPS.addInteractor({
          at: { path: "1/2/0", orientation: Before },
          selectionAnchor: { path: "3/0/0", orientation: After },
          focused: true,
        })
      );
      editor.execute(OPS.joinBlocks({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
MAIN CURSOR: <| 1/2/0
SLICE:  PARAGRAPH > TEXT {} > "NN"
S.A. CURSOR: 1/5/0 |>
SLICE:  PARAGRAPH > TEXT {} > "CC"`);
      expect(debugCurrentBlock(editor)).toEqual(`
MAIN CURSOR:
PARAGRAPH > TEXT {} > "MM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "NN"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"
PARAGRAPH > TEXT {} > "CC"
PARAGRAPH > URL_LINK g.com > "GOOGLE"
PARAGRAPH > TEXT {} > "DD"
S.A. CURSOR:
PARAGRAPH > TEXT {} > "MM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "NN"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"
PARAGRAPH > TEXT {} > "CC"
PARAGRAPH > URL_LINK g.com > "GOOGLE"
PARAGRAPH > TEXT {} > "DD"`);
    });
  });

  describe("forwards", () => {
    it("basically works", () => {
      const editor = new Editor({ document: testDoc1, omitDefaultInteractor: true });
      editor.execute(
        OPS.addInteractor({
          at: { path: "1/2/0", orientation: Before },
          selectionAnchor: { path: "3/0/0", orientation: After },
          focused: true,
        })
      );
      editor.execute(OPS.joinBlocks({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
MAIN CURSOR: <| 1/2/0
SLICE:  PARAGRAPH > TEXT {} > "NN"
S.A. CURSOR: 1/5/0 |>
SLICE:  PARAGRAPH > TEXT {} > "CC"`);
      expect(debugCurrentBlock(editor)).toEqual(`
MAIN CURSOR:
PARAGRAPH > TEXT {} > "MM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "NN"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"
PARAGRAPH > TEXT {} > "CC"
PARAGRAPH > URL_LINK g.com > "GOOGLE"
PARAGRAPH > TEXT {} > "DD"
S.A. CURSOR:
PARAGRAPH > TEXT {} > "MM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "NN"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"
PARAGRAPH > TEXT {} > "CC"
PARAGRAPH > URL_LINK g.com > "GOOGLE"
PARAGRAPH > TEXT {} > "DD"`);
    });
  });
});
