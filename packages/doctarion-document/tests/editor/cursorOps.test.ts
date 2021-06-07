import { CursorOrientation } from "../../src/cursor";
import { Editor, EditorOperationError, OPS, TargetInteractors } from "../../src/editor";
import { HeaderLevel } from "../../src/models";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { Before, After } = CursorOrientation;
const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugInteractors = DebugEditorHelpers.debugInteractorOrdering;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN")),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"))
);

describe("moveForward", () => {
  it("behaves correctly at the end of the doc", () => {
    const editor = new Editor({ document: testDoc1 });
    // Jump to L in the "GOOGLE" text of the url link
    // Note the cursor would be at: GOOG|LE
    editor.update(OPS.jump({ to: { path: "3/1/4", orientation: Before } }));
    editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1/4 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);

    editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1/5 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);

    editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);

    // This next moveForward should have no effect
    editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);
  });

  // it("handles multiple cursors", () => {
  //   const editor = new Editor({ document: testDoc1 });
  //   // Jump to "GOOGLE" text of the url link
  //   editor.update(OPS.jump({ to: { path: "3/1/0", orientation: Before } }));
  //   // editor.update(OPS.addInteractor({ at: { path: "3/1/1", orientation: Before } }));
  //   // editor.update(OPS.addInteractor({ at: { path: "3/1/2", orientation: Before } }));

  //   // expect(debugInteractors(editor)).toEqual("1.M (F) <| 3/1/0, 2.M <| 3/1/1, 3.M <| 3/1/2");
  //   // editor.update(OPS.moveForward({ target: TargetInteractors.All }));
  //   // expect(debugInteractors(editor)).toEqual("1.M (F) 3/1/0 |>, 2.M <| 3/1/1, 3.M <| 3/1/2");
  //   // editor.update(OPS.moveForward({ target: TargetInteractors.AllActive }));
  //   // expect(debugInteractors(editor)).toEqual("1.M (F) <| 3/1/0, 2.M <| 3/1/1, 3.M <| 3/1/2");
  //   // // Should dedupe
  //   // editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
  //   // expect(debugInteractors(editor)).toEqual("1.M (F) <| 3/1/0, 2.M <| 3/1/1, 3.M <| 3/1/2");
  // });
});

describe("jump", () => {
  it("errors on jumping to invalid paths", () => {
    const editor = new Editor({ document: testDoc1 });

    expect(() => editor.update(OPS.jump({ to: { path: "4", orientation: Before } }))).toThrowError(
      EditorOperationError
    );

    expect(() => editor.update(OPS.jump({ to: { path: "1/2/99", orientation: Before } }))).toThrowError(
      EditorOperationError
    );
  });

  it("jumping to non-graphemes non insertion-points is handled gracefully", () => {
    const editor = new Editor({ document: testDoc1 });

    editor.update(OPS.jump({ to: { path: "0", orientation: Before } }));
    expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0/0
SLICE:  HEADER ONE > TEXT {} > "H1"`);

    editor.update(OPS.jump({ to: { path: "", orientation: After } }));
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);

    editor.update(OPS.jump({ to: { path: "1/2", orientation: Before } }));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/1
SLICE:  PARAGRAPH > TEXT {} > ""`);
  });
});
