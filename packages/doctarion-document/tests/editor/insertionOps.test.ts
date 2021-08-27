import { CursorOrientation } from "../../src/cursor";
import { HeaderLevel } from "../../src/document-model";
import { Editor, EditorOperationError, OPS, TargetInteractors } from "../../src/editor";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { Before, On, After } = CursorOrientation;
const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugCurrentBlock = DebugEditorHelpers.debugCurrentBlock;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MMM"), inlineText(""), inlineText("NNN")),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", ""), inlineText("DD")),
  paragraph(inlineUrlLink("e.com", "EE"), inlineUrlLink("f.com", "FF")),
  header(HeaderLevel.One)
);

describe("insertText", () => {
  it("inserts into the beginning of inline text", () => {
    const editor = new Editor({ document: testDoc1 });
    // Note the cursor orientation is before the charater
    editor.execute(OPS.jump({ to: { path: "0/0/0", orientation: Before } }));
    editor.execute(OPS.insertText("Q"));
    expect(debugState(editor)).toEqual(`
CURSOR: 0/0/0 |>
SLICE:  HEADER ONE > TEXT {} > "QH1"`);
  });

  it("inserts into the middle of inline text", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "1/0/1", orientation: After } }));
    editor.execute(OPS.insertText("Q"));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/0/2 |>
SLICE:  PARAGRAPH > TEXT {} > "MMQM"`);

    editor.execute(OPS.insertText("R"));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/0/3 |>
SLICE:  PARAGRAPH > TEXT {} > "MMQRM"`);

    editor.execute(OPS.moveBack({ target: TargetInteractors.Focused }));
    editor.execute(OPS.moveBack({ target: TargetInteractors.Focused }));
    editor.execute(OPS.moveForward({ target: TargetInteractors.Focused }));
    // Cursor should now be at MMNQ|RM
    editor.execute(OPS.insertText("S"));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/0/3 |>
SLICE:  PARAGRAPH > TEXT {} > "MMQSRM"`);
  });

  it("inserts into an empty paragraph successfully", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "2", orientation: On } }));
    editor.execute(OPS.insertText("Q"));
    expect(debugState(editor)).toEqual(`
CURSOR: 2/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "Q"`);
  });

  it("inserts into an empty header successfully", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "5", orientation: On } }));
    editor.execute(OPS.insertText("Q"));
    expect(debugState(editor)).toEqual(`
CURSOR: 5/0/0 |>
SLICE:  HEADER ONE > TEXT {} > "Q"`);
  });

  it("inserts into an empty inline text", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "1/1", orientation: On } }));
    editor.execute(OPS.insertText("Q"));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/1/0 |>
SLICE:  PARAGRAPH > TEXT {} > "Q"`);
  });

  it("inserts into an empty inline url link successfully", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "3/1", orientation: On } }));
    editor.execute(OPS.insertText("Q"));
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1/0 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "Q"`);
  });

  it("inserts into an empty document successfully", () => {
    const editor = new Editor({ document: doc(paragraph()) });
    editor.execute(OPS.insertText("Q"));
    expect(debugState(editor)).toEqual(`
CURSOR: 0/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "Q"`);
  });

  it("inserts multiple graphemes successfully", () => {
    const editor = new Editor({ document: testDoc1 });
    // Jump to second N in the "NNN" inline text
    editor.execute(OPS.jump({ to: { path: "1/2/1", orientation: After } }));
    editor.execute(OPS.insertText("QST"));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/2/4 |>
SLICE:  PARAGRAPH > TEXT {} > "NNQSTN"`);
  });

  it("inserts between inline url links successfully", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "4/0", orientation: After } }));
    editor.execute(OPS.insertText("QST"));
    expect(debugState(editor)).toEqual(`
CURSOR: 4/1/2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
  });

  it("inserts between inline url link and the beginning of a paragraph successfully", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "4/0", orientation: Before } }));
    editor.execute(OPS.insertText("QST"));
    expect(debugState(editor)).toEqual(`
CURSOR: 4/0/2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
  });

  it("inserts between inline url link and the end of a paragraph successfully successfully", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "4/1", orientation: After } }));
    editor.execute(OPS.insertText("QST"));
    expect(debugState(editor)).toEqual(`
CURSOR: 4/2/2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
  });

  it("does not insert new text between two inline texts", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "1/0", orientation: After } }));
    editor.execute(OPS.insertText("QST"));
    expect(debugState(editor)).not.toEqual(`
CURSOR: 1/1/2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
  });

  it("does not insert new text before an inline text", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "0/0", orientation: Before } }));
    editor.execute(OPS.insertText("QST"));
    expect(debugState(editor)).not.toEqual(`
CURSOR: 0/0/2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
  });

  it("does not insert new text after an inline text", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "0/0", orientation: After } }));
    editor.execute(OPS.insertText("QST"));
    expect(debugState(editor)).not.toEqual(`
CURSOR: 0/1/2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
  });
});

describe("insertUrlLink", () => {
  // ---------------------------------------------------------------------------
  // Insertion at the Paragraph Level
  // ---------------------------------------------------------------------------
  it("should insert into an empty paragraph", () => {
    const editor = new Editor({ document: doc(paragraph()) });
    editor.execute(OPS.jump({ to: { path: "0", orientation: On } }));
    editor.execute(OPS.insertUrlLink(inlineUrlLink("test.com", "ABC")));
    expect(debugState(editor)).toEqual(`
CURSOR: 0/0/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
  });

  // ---------------------------------------------------------------------------
  // Insertion at the Inline Level
  // ---------------------------------------------------------------------------

  it("should fail to insert into an empty inline text", () => {
    // This could be changed at some later date...
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "1/1", orientation: On } }));
    expect(() => editor.execute(OPS.insertUrlLink(inlineUrlLink("test.com", "ABC")))).toThrowError(
      EditorOperationError
    );
  });

  it("should insert before an inline url link", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "4/0", orientation: Before } }));
    editor.execute(OPS.insertUrlLink(inlineUrlLink("test.com", "ABC")));

    expect(debugState(editor)).toEqual(`
CURSOR: 4/0/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);

    // Check that prior and later content elements are what we expect
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > URL_LINK e.com > "EE"
PARAGRAPH > URL_LINK f.com > "FF"`);
  });

  it("should insert between inline url links", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "4/1", orientation: Before } }));
    editor.execute(OPS.insertUrlLink(inlineUrlLink("test.com", "ABC")));

    expect(debugState(editor)).toEqual(`
CURSOR: 4/1/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);

    // Check that prior and later content elements are what we expect
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > URL_LINK e.com > "EE"
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > URL_LINK f.com > "FF"`);
  });

  it("should insert after inline url links", () => {
    let editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "4/0", orientation: After } }));
    editor.execute(OPS.insertUrlLink(inlineUrlLink("test.com", "ABC")));

    expect(debugState(editor)).toEqual(`
CURSOR: 4/1/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);

    // Check that prior and later content elements are what we expect
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > URL_LINK e.com > "EE"
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > URL_LINK f.com > "FF"`);

    editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "4/1", orientation: After } }));
    editor.execute(OPS.insertUrlLink(inlineUrlLink("test.com", "ABC")));

    expect(debugState(editor)).toEqual(`
CURSOR: 4/2/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);

    // Check that prior and later content elements are what we expect
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > URL_LINK e.com > "EE"
PARAGRAPH > URL_LINK f.com > "FF"
PARAGRAPH > URL_LINK test.com > "ABC"`);
  });

  // ---------------------------------------------------------------------------
  // Insertion at the Grapheme Level
  // ---------------------------------------------------------------------------

  it("should insert into the middle of a inline text with before orientation", () => {
    const editor = new Editor({ document: testDoc1 });
    // This is putting the cursor in the middle of the NNN inline text
    editor.execute(OPS.jump({ to: { path: "1/2/1", orientation: Before } }));
    editor.execute(OPS.insertUrlLink(inlineUrlLink("test.com", "ABC")));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/3/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
    // Check that prior and later content elements are what we expect
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MMM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "N"
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > TEXT {} > "NN"`);
  });

  it("should insert into the middle of a inline text with after orientation", () => {
    const editor = new Editor({ document: testDoc1 });
    // This is putting the cursor in the middle of the NNN inline text
    editor.execute(OPS.jump({ to: { path: "1/2/1", orientation: After } }));
    editor.execute(OPS.insertUrlLink(inlineUrlLink("test.com", "ABC")));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/3/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
    // Check that prior and later content elements are what we expect
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MMM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "NN"
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > TEXT {} > "N"`);
  });

  it("should insert at the beginning of an inline text", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "1/0/0", orientation: Before } }));
    editor.execute(OPS.insertUrlLink(inlineUrlLink("test.com", "ABC")));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/0/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
    // Check that prior and later content elements are what we expect
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > TEXT {} > "MMM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "NNN"`);
  });

  it("should insert at the end of an inline text", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "1/2/2", orientation: After } }));
    editor.execute(OPS.insertUrlLink(inlineUrlLink("test.com", "ABC")));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/3/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
    // Check that prior and later content elements are what we expect
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MMM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "NNN"
PARAGRAPH > URL_LINK test.com > "ABC"`);
  });

  it("should insert between two inline texts", () => {
    const editor = new Editor({ document: doc(paragraph(inlineText("AA"), inlineText("BB"))) });
    editor.execute(OPS.jump({ to: { path: "0/0/1", orientation: After } }));
    editor.execute(OPS.insertUrlLink(inlineUrlLink("test.com", "ABC")));
    expect(debugState(editor)).toEqual(`
CURSOR: 0/1/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
    // Check that prior and later content elements are what we expect
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > TEXT {} > "BB"`);
  });
});
