import { CursorOrientation } from "../../src/cursor";
import { HeaderLevel } from "../../src/document-model";
import { Editor, OPS, TargetInteractors } from "../../src/editor";
import { FlowDirection, InteractorStatus } from "../../src/working-document";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { Before, After } = CursorOrientation;
const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugCurrentBlock = DebugEditorHelpers.debugCurrentBlock;
const debugBlockSimple = DebugEditorHelpers.debugBlockSimple;
const debugInteractors = DebugEditorHelpers.debugInteractors;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"), inlineText("DD"))
);

describe("joinBlocks for a single selection interactor", () => {
  describe("backwards", () => {
    it("basically works", () => {
      const editor = new Editor({ document: testDoc1, omitDefaultInteractor: true });
      editor.execute(
        OPS.addInteractor({
          at: { path: "1/2/0", orientation: Before },
          selectTo: { path: "3/0/0", orientation: After },
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
          selectTo: { path: "3/0/0", orientation: After },
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

describe("joinInlineText for a single selection interactor", () => {
  it("basically works", () => {
    let editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "1/0/0", orientation: After } }));
    editor.execute(OPS.jump({ to: { path: "1/4/0", orientation: After }, select: true }));
    editor.execute(OPS.joinInlineText({ direction: FlowDirection.Backward }));
    expect(debugState(editor)).toEqual(`
MAIN CURSOR: 1/0/6 |>
SLICE:  PARAGRAPH > TEXT {} > "MMNNAABB"
S.A. CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "MMNNAABB"`);

    editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "1/0/0", orientation: After } }));
    editor.execute(OPS.jump({ to: { path: "1/4/0", orientation: After }, select: true }));
    editor.execute(OPS.joinInlineText({ direction: FlowDirection.Forward }));
    expect(debugState(editor)).toEqual(`
MAIN CURSOR: 1/0/6 |>
SLICE:  PARAGRAPH > TEXT {BOLD} > "MMNNAABB"
S.A. CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {BOLD} > "MMNNAABB"`);
  });

  it("handles large selections covering multiple blocks and other inlines", () => {
    let editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "0/0/0", orientation: After } }));
    editor.execute(OPS.jump({ to: { path: "3/2/1", orientation: After }, select: true }));
    editor.execute(OPS.joinInlineText({ direction: FlowDirection.Backward }));
    expect(debugState(editor)).toEqual(`
MAIN CURSOR: 3/2/1 |>
SLICE:  PARAGRAPH > TEXT {} > "DD"
S.A. CURSOR: 0/0/0 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);
    expect(debugBlockSimple(editor.state.document, "1")).toMatchInlineSnapshot(`
      "
      PARAGRAPH > TEXT {} > \\"MMNNAABB\\""
    `);
    expect(debugBlockSimple(editor.state.document, "2")).toMatchInlineSnapshot(`""`);
    expect(debugBlockSimple(editor.state.document, "3")).toMatchInlineSnapshot(`
      "
      PARAGRAPH > TEXT {} > \\"CC\\"
      PARAGRAPH > URL_LINK g.com > \\"GOOGLE\\"
      PARAGRAPH > TEXT {} > \\"DD\\""
    `);

    editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "0/0/0", orientation: After } }));
    editor.execute(OPS.jump({ to: { path: "3/2/1", orientation: After }, select: true }));
    editor.execute(OPS.joinInlineText({ direction: FlowDirection.Forward }));
    expect(debugState(editor)).toEqual(`
MAIN CURSOR: 3/2/1 |>
SLICE:  PARAGRAPH > TEXT {} > "DD"
S.A. CURSOR: 0/0/0 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);
    expect(debugBlockSimple(editor.state.document, "1")).toMatchInlineSnapshot(`
      "
      PARAGRAPH > TEXT {BOLD} > \\"MMNNAABB\\""
    `);
    expect(debugBlockSimple(editor.state.document, "2")).toMatchInlineSnapshot(`""`);
    expect(debugBlockSimple(editor.state.document, "3")).toMatchInlineSnapshot(`
      "
      PARAGRAPH > TEXT {} > \\"CC\\"
      PARAGRAPH > URL_LINK g.com > \\"GOOGLE\\"
      PARAGRAPH > TEXT {} > \\"DD\\""
    `);
  });

  it("when merging blocks forward, an anchor on a empty block is moved appropriately", () => {
    const editor = new Editor({ document: testDoc1 });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    editor.execute(OPS.updateInteractor({ id: editor.state.focusedInteractor!.id, name: "α" }));
    editor.execute(OPS.jump({ to: { path: "1/2/0", orientation: After } }));

    editor.execute(
      OPS.addInteractor({
        at: { path: "2", orientation: After },
        selectTo: {
          path: "3/1/4",
          orientation: After,
        },
        status: InteractorStatus.Inactive,
        name: "β",
      })
    );

    editor.execute(OPS.joinBlocks({ target: TargetInteractors.AllActive, direction: FlowDirection.Forward }));
    expect(debugInteractors(editor)).toMatchInlineSnapshot(`"α (F) 1/2/0 |>, β (I) 1/4/1 |> ◉◀◀◀ 2/1/4 |>"`);
  });
});
