import { CursorAffinity } from "../../src/cursor";
import { Editor, EditorOperationError, OPS } from "../../src/editor";
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
    editor.update(OPS.jumpTo({ path: "3/1/4", affinity: Before }));
    editor.update(OPS.moveForward());
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1/4 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);

    editor.update(OPS.moveForward());
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1/5 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);

    editor.update(OPS.moveForward());
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);

    // This next moveForward should have no effect
    editor.update(OPS.moveForward());
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);
  });
});

describe("jump", () => {
  it("errors on jumping to invalid paths", () => {
    const editor = new Editor({ document: testDoc1 });

    expect(() => editor.update(OPS.jumpTo({ path: "4", affinity: Before }))).toThrowError(EditorOperationError);

    expect(() => editor.update(OPS.jumpTo({ path: "1/2/99", affinity: Before }))).toThrowError(EditorOperationError);
  });

  it("jumping to non-graphemes non insertion-points is handled gracefully", () => {
    const editor = new Editor({ document: testDoc1 });

    editor.update(OPS.jumpTo({ path: "0", affinity: Before }));
    expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0/0
SLICE:  HEADER ONE > TEXT {} > "H1"`);

    editor.update(OPS.jumpTo({ path: "", affinity: After }));
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);

    editor.update(OPS.jumpTo({ path: "1/2", affinity: Before }));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/1
SLICE:  PARAGRAPH > TEXT {} > ""`);
  });
});
