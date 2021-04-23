import { CursorAffinity } from "../../src/cursor";
import { Editor, OperationError, Ops } from "../../src/editor";
import * as Models from "../../src/models";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { Before, Neutral, After } = CursorAffinity;
const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugCurrentBlock = DebugEditorHelpers.debugCurrentBlock;

const testDoc1 = doc(
  header(Models.HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MMM"), inlineText(""), inlineText("NNN")),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", ""), inlineText("DD")),
  paragraph(inlineUrlLink("e.com", "EE"), inlineUrlLink("f.com", "FF")),
  header(Models.HeaderLevel.One)
);

describe("insertText", () => {
  it("inserts into the beginning of inline text", () => {
    const editor = new Editor(testDoc1);
    // Note the cursor affinity is before the charater
    editor.update(Ops.jumpTo("block:0/content:0/cp:0", Before));
    editor.update(Ops.insertText("Q"));
    expect(debugState(editor)).toEqual(`
CURSOR: block:0/content:0/cp:0 |>
SLICE:  HEADER ONE > TEXT {} > "QH1"`);
  });

  it("inserts into the middle of inline text", () => {
    const editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:1/content:0/cp:1", After));
    editor.update(Ops.insertText("Q"));
    expect(debugState(editor)).toEqual(`
CURSOR: block:1/content:0/cp:2 |>
SLICE:  PARAGRAPH > TEXT {} > "MMQM"`);

    editor.update(Ops.insertText("R"));
    expect(debugState(editor)).toEqual(`
CURSOR: block:1/content:0/cp:3 |>
SLICE:  PARAGRAPH > TEXT {} > "MMQRM"`);

    editor.update(Ops.moveBack);
    editor.update(Ops.moveBack);
    editor.update(Ops.moveForward);
    // Cursor should now be at MMNQ|RM
    editor.update(Ops.insertText("S"));
    expect(debugState(editor)).toEqual(`
CURSOR: block:1/content:0/cp:3 |>
SLICE:  PARAGRAPH > TEXT {} > "MMQSRM"`);
  });

  it("inserts into an empty paragraph successfully", () => {
    const editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:2", Neutral));
    editor.update(Ops.insertText("Q"));
    expect(debugState(editor)).toEqual(`
CURSOR: block:2/content:0/cp:0 |>
SLICE:  PARAGRAPH > TEXT {} > "Q"`);
  });

  it("inserts into an empty header successfully", () => {
    const editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:5", Neutral));
    editor.update(Ops.insertText("Q"));
    expect(debugState(editor)).toEqual(`
CURSOR: block:5/content:0/cp:0 |>
SLICE:  HEADER ONE > TEXT {} > "Q"`);
  });

  it("inserts into an empty inline text", () => {
    const editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:1/content:1", Neutral));
    editor.update(Ops.insertText("Q"));
    expect(debugState(editor)).toEqual(`
CURSOR: block:1/content:1/cp:0 |>
SLICE:  PARAGRAPH > TEXT {} > "Q"`);
  });

  it("inserts into an empty inline url link successfully", () => {
    const editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:3/content:1", Neutral));
    editor.update(Ops.insertText("Q"));
    expect(debugState(editor)).toEqual(`
CURSOR: block:3/content:1/cp:0 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "Q"`);
  });

  it("inserts into an empty document successfully", () => {
    const editor = new Editor(doc());
    editor.update(Ops.insertText("Q"));
    expect(debugState(editor)).toEqual(`
CURSOR: block:0/content:0/cp:0 |>
SLICE:  PARAGRAPH > TEXT {} > "Q"`);
  });

  it("inserts muliple graphemes successfully", () => {
    const editor = new Editor(testDoc1);
    // Jump to second N in the "NNN" inline text
    editor.update(Ops.jumpTo("block:1/content:2/cp:1", After));
    editor.update(Ops.insertText("QST"));
    expect(debugState(editor)).toEqual(`
CURSOR: block:1/content:2/cp:4 |>
SLICE:  PARAGRAPH > TEXT {} > "NNQSTN"`);
  });

  it("inserts between inline url links successfully", () => {
    const editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:4/content:0", After));
    editor.update(Ops.insertText("QST"));
    expect(debugState(editor)).toEqual(`
CURSOR: block:4/content:1/cp:2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
  });

  it("inserts between inline url link and the beginning of a paragraph successfully", () => {
    const editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:4/content:0", Before));
    editor.update(Ops.insertText("QST"));
    expect(debugState(editor)).toEqual(`
CURSOR: block:4/content:0/cp:2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
  });

  it("inserts between inline url link and the end of a paragraph successfully successfully", () => {
    const editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:4/content:1", After));
    editor.update(Ops.insertText("QST"));
    expect(debugState(editor)).toEqual(`
CURSOR: block:4/content:2/cp:2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
  });

  it("does not insert new text between two inline texts", () => {
    const editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:1/content:0", After));
    editor.update(Ops.insertText("QST"));
    expect(debugState(editor)).not.toEqual(`
CURSOR: block:1/content:1/cp:2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
  });

  it("does not insert new text before an inline text", () => {
    const editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:0/content:0", Before));
    editor.update(Ops.insertText("QST"));
    expect(debugState(editor)).not.toEqual(`
CURSOR: block:0/content:0/cp:2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
  });

  it("does not insert new text after an inline text", () => {
    const editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:0/content:0", After));
    editor.update(Ops.insertText("QST"));
    expect(debugState(editor)).not.toEqual(`
CURSOR: block:0/content:1/cp:2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
  });
});

describe("insertUrlLink", () => {
  // ---------------------------------------------------------------------------
  // Insertion at the Paragraph Level
  // ---------------------------------------------------------------------------
  it("should insert into an empty paragraph", () => {
    const editor = new Editor(doc(paragraph()));
    editor.update(Ops.jumpTo("block:0", Neutral));
    editor.update(Ops.insertUrlLink(inlineUrlLink("test.com", "ABC")));
    expect(debugState(editor)).toEqual(`
CURSOR: block:0/content:0/cp:2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
  });

  // ---------------------------------------------------------------------------
  // Insertion at the Inline Level
  // ---------------------------------------------------------------------------

  it("should fail to insert into an empty inline text", () => {
    // This could be changed at some later date...
    const editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:1/content:1", Neutral));
    expect(() => editor.update(Ops.insertUrlLink(inlineUrlLink("test.com", "ABC")))).toThrowError(OperationError);
  });

  it("should insert before an inline url link", () => {
    const editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:4/content:0", Before));
    editor.update(Ops.insertUrlLink(inlineUrlLink("test.com", "ABC")));

    expect(debugState(editor)).toEqual(`
CURSOR: block:4/content:0/cp:2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);

    // Check that prior and later content elements are what we expect
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > URL_LINK e.com > "EE"
PARAGRAPH > URL_LINK f.com > "FF"`);
  });

  it("should insert between inline url links", () => {
    const editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:4/content:1", Before));
    editor.update(Ops.insertUrlLink(inlineUrlLink("test.com", "ABC")));

    expect(debugState(editor)).toEqual(`
CURSOR: block:4/content:1/cp:2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);

    // Check that prior and later content elements are what we expect
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > URL_LINK e.com > "EE"
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > URL_LINK f.com > "FF"`);
  });

  it("should insert after inline url links", () => {
    let editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:4/content:0", After));
    editor.update(Ops.insertUrlLink(inlineUrlLink("test.com", "ABC")));

    expect(debugState(editor)).toEqual(`
CURSOR: block:4/content:1/cp:2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);

    // Check that prior and later content elements are what we expect
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > URL_LINK e.com > "EE"
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > URL_LINK f.com > "FF"`);

    editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:4/content:1", After));
    editor.update(Ops.insertUrlLink(inlineUrlLink("test.com", "ABC")));

    expect(debugState(editor)).toEqual(`
CURSOR: block:4/content:2/cp:2 |>
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

  it("should insert into the middle of a inline text with before affinity", () => {
    const editor = new Editor(testDoc1);
    // This is putting the cursor in the middle of the NNN inline text
    editor.update(Ops.jumpTo("block:1/content:2/cp:1", Before));
    editor.update(Ops.insertUrlLink(inlineUrlLink("test.com", "ABC")));
    expect(debugState(editor)).toEqual(`
CURSOR: block:1/content:3/cp:2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
    // Check that prior and later content elements are what we expect
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MMM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "N"
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > TEXT {} > "NN"`);
  });

  it("should insert into the middle of a inline text with after affinity", () => {
    const editor = new Editor(testDoc1);
    // This is putting the cursor in the middle of the NNN inline text
    editor.update(Ops.jumpTo("block:1/content:2/cp:1", After));
    editor.update(Ops.insertUrlLink(inlineUrlLink("test.com", "ABC")));
    expect(debugState(editor)).toEqual(`
CURSOR: block:1/content:3/cp:2 |>
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
    const editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:1/content:0/cp:0", Before));
    editor.update(Ops.insertUrlLink(inlineUrlLink("test.com", "ABC")));
    expect(debugState(editor)).toEqual(`
CURSOR: block:1/content:0/cp:2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
    // Check that prior and later content elements are what we expect
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > TEXT {} > "MMM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "NNN"`);
  });

  it("should insert at the end of an inline text", () => {
    const editor = new Editor(testDoc1);
    editor.update(Ops.jumpTo("block:1/content:2/cp:2", After));
    editor.update(Ops.insertUrlLink(inlineUrlLink("test.com", "ABC")));
    expect(debugState(editor)).toEqual(`
CURSOR: block:1/content:3/cp:2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
    // Check that prior and later content elements are what we expect
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MMM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "NNN"
PARAGRAPH > URL_LINK test.com > "ABC"`);
  });

  it("should insert between two inline texts", () => {
    const editor = new Editor(doc(paragraph(inlineText("AA"), inlineText("BB"))));
    editor.update(Ops.jumpTo("block:0/content:0/cp:1", After));
    editor.update(Ops.insertUrlLink(inlineUrlLink("test.com", "ABC")));
    expect(debugState(editor)).toEqual(`
CURSOR: block:0/content:1/cp:2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
    // Check that prior and later content elements are what we expect
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > TEXT {} > "BB"`);
  });
});
