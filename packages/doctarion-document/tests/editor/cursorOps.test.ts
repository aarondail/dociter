import { CursorOrientation } from "../../src/cursor";
import { Editor, EditorOperationError, OPS, TargetInteractors } from "../../src/editor";
import { HeaderLevel } from "../../src/models";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { Before, After } = CursorOrientation;
const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugInteractors = DebugEditorHelpers.debugInteractorsTake2;

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
    editor.execute(OPS.jump({ to: { path: "3/1/4", orientation: Before } }));
    editor.execute(OPS.moveForward({ target: TargetInteractors.Focused }));
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1/4 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);

    editor.execute(OPS.moveForward({ target: TargetInteractors.Focused }));
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1/5 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);

    editor.execute(OPS.moveForward({ target: TargetInteractors.Focused }));
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);

    // This next moveForward should have no effect
    editor.execute(OPS.moveForward({ target: TargetInteractors.Focused }));
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);
  });

  it("handles multiple cursors", () => {
    const editor = new Editor({ document: testDoc1 });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    editor.execute(OPS.updateInteractor({ id: editor.focusedInteractor!.id, name: "α" }));

    // Jump to "GOOGLE" text of the url link
    editor.execute(OPS.jump({ to: { path: "3/1/0", orientation: Before } }));
    editor.execute(OPS.addInteractor({ at: { path: "3/1/1", orientation: After }, name: "β" }));
    editor.execute(OPS.addInteractor({ at: { path: "3/1/2", orientation: After }, name: "γ" }));

    expect(debugInteractors(editor)).toEqual(`α (F) <| 3/1/0, β 3/1/1 |>, γ 3/1/2 |>`);
    editor.execute(OPS.moveForward({ target: TargetInteractors.All }));
    expect(debugInteractors(editor)).toEqual(`α (F) 3/1/0 |>, β 3/1/2 |>, γ 3/1/3 |>`);
    editor.execute(OPS.moveForward({ target: TargetInteractors.AllActive }));
    expect(debugInteractors(editor)).toEqual(`α (F) 3/1/1 |>, β 3/1/3 |>, γ 3/1/4 |>`);
    // Should dedupe
    editor.execute(OPS.moveForward({ target: TargetInteractors.Focused }));
    editor.execute(OPS.moveForward({ target: TargetInteractors.Focused }));
    expect(debugInteractors(editor)).toEqual(`α (F) 3/1/3 |>, γ 3/1/4 |>`);
    editor.execute(OPS.moveForward({ target: TargetInteractors.Focused }));
    expect(debugInteractors(editor)).toEqual(`α (F) 3/1/4 |>`);
  });
});

describe("jump", () => {
  it("errors on jumping to invalid paths", () => {
    const editor = new Editor({ document: testDoc1 });

    expect(() => editor.execute(OPS.jump({ to: { path: "4", orientation: Before } }))).toThrowError(
      EditorOperationError
    );

    expect(() => editor.execute(OPS.jump({ to: { path: "1/2/99", orientation: Before } }))).toThrowError(
      EditorOperationError
    );
  });

  it("jumping to non-graphemes non insertion-points is handled gracefully", () => {
    const editor = new Editor({ document: testDoc1 });

    editor.execute(OPS.jump({ to: { path: "0", orientation: Before } }));
    expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0/0
SLICE:  HEADER ONE > TEXT {} > "H1"`);

    editor.execute(OPS.jump({ to: { path: "", orientation: After } }));
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGLE"`);

    editor.execute(OPS.jump({ to: { path: "1/2", orientation: Before } }));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/1
SLICE:  PARAGRAPH > TEXT {} > ""`);
  });

  it("may dedupe multiple cursors", () => {
    const editor = new Editor({ document: testDoc1 });
    // Jump to "GOOGLE" text of the url link
    editor.execute(OPS.addInteractor({ at: { path: "3/1/1", orientation: After } }));
    editor.execute(OPS.jump({ to: { path: "3/1/1", orientation: After } }));
    expect(debugInteractors(editor)).toEqual("(no-name, #1) (F) 3/1/1 |>");
  });
});
