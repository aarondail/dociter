import { CursorAffinity } from "../../src/cursor";
import { Editor, EditorOperationError, Ops } from "../../src/editor";
import { HeaderLevel } from "../../src/models";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { Before, After } = CursorAffinity;
const debugState = DebugEditorHelpers.debugEditorStateSimple;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN")),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"))
);

describe("moveForward", () => {
  it("behaves correctly at the end of the doc with cursor", () => {
    const editor = new Editor({ document: testDoc1 });
    // Jump to L in the "GOOGLE" text of the url link
    // Note the cursor would be at: GOOG|LE
    editor.update(Ops.jumpTo("3/1/4", Before));
    editor.update(Ops.moveForward);
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1/4 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);

    editor.update(Ops.moveForward);
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1/5 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);

    editor.update(Ops.moveForward);
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);

    // This next moveForward should have no effect
    editor.update(Ops.moveForward);
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);
  });
});

describe("jump", () => {
  it("errors on jumping to invalid paths", () => {
    const editor = new Editor({ document: testDoc1 });

    expect(() => editor.update(Ops.jumpTo("4", Before))).toThrowError(EditorOperationError);

    expect(() => editor.update(Ops.jumpTo("1/2/99", Before))).toThrowError(EditorOperationError);
  });

  it("jumping to non-graphemes non insertion-points is handled gracefully", () => {
    const editor = new Editor({ document: testDoc1 });

    editor.update(Ops.jumpTo("0", Before));
    expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0/0
SLICE:  HEADER ONE > TEXT {} > "H1"`);

    editor.update(Ops.jumpTo("", After));
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);

    editor.update(Ops.jumpTo("1/2", Before));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/1
SLICE:  PARAGRAPH > TEXT {} > ""`);
  });
});
