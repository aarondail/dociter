/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { CursorOrientation } from "../../src/cursor";
import { HeaderLevel } from "../../src/document-model";
import { Editor, OPS, TargetInteractors } from "../../src/editor";
import { FlowDirection, InteractorStatus } from "../../src/working-document";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { Before, On, After } = CursorOrientation;
const { Inactive, Active } = InteractorStatus;

const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugCurrentBlock = DebugEditorHelpers.debugCurrentBlock;
const debugInteractors = DebugEditorHelpers.debugInteractors;
const debugBlockSimple = DebugEditorHelpers.debugBlockSimple;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1", { italic: true })),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"), inlineText("DD"))
);

describe("joinBlocks for multiple interactors", () => {
  describe("backwards", () => {
    it("basically works with one focused interactor", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.updateInteractor({ id: editor.state.focusedInteractor!.id, name: "α" }));
      editor.execute(OPS.jump({ to: { path: "1/2/0", orientation: After } }));
      editor.execute(OPS.addInteractor({ at: { path: "0/0/0", orientation: Before }, name: "β" }));
      editor.execute(OPS.addInteractor({ at: { path: "1/0/0", orientation: Before }, name: "γ" }));
      editor.execute(OPS.addInteractor({ at: { path: "1/1", orientation: On }, name: "δ" }));
      editor.execute(OPS.addInteractor({ at: { path: "1/2/1", orientation: After }, name: "ε" }));
      editor.execute(OPS.addInteractor({ at: { path: "1/3/1", orientation: After }, name: "ζ" }));
      editor.execute(
        OPS.addInteractor({
          at: { path: "2", orientation: After },
          selectTo: {
            path: "3/1/4",
            orientation: After,
          },
          name: "η",
        })
      );
      editor.execute(OPS.joinBlocks({ target: TargetInteractors.Focused, direction: FlowDirection.Backward }));
      expect(debugInteractors(editor)).toMatchInlineSnapshot(
        `"α (F) 0/3/0 |>, β <| 0/0/0, γ 0/0/1 |>, δ 0/2, ε 0/3/1 |>, ζ 0/4/1 |>, η 1 ◉◀◀◀ 2/1/4 |>"`
      );
    });

    it("works with multiple interactors being targeted", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.updateInteractor({ id: editor.state.focusedInteractor!.id, name: "α" }));
      editor.execute(OPS.jump({ to: { path: "1/2/0", orientation: After } }));
      editor.execute(OPS.addInteractor({ at: { path: "0/0/0", orientation: Before }, name: "β", status: Inactive }));
      editor.execute(OPS.addInteractor({ at: { path: "1/0/0", orientation: Before }, name: "γ", status: Active }));
      editor.execute(OPS.addInteractor({ at: { path: "1/1", orientation: On }, name: "δ", status: Inactive }));
      editor.execute(OPS.addInteractor({ at: { path: "1/2/1", orientation: After }, name: "ε", status: Inactive }));
      editor.execute(OPS.addInteractor({ at: { path: "3/0/1", orientation: After }, name: "ζ", status: Active }));

      editor.execute(
        OPS.addInteractor({
          at: { path: "2", orientation: After },
          selectTo: {
            path: "3/1/4",
            orientation: After,
          },
          status: Inactive,
          name: "η",
        })
      );
      editor.execute(OPS.joinBlocks({ target: TargetInteractors.AllActive, direction: FlowDirection.Backward }));
      expect(debugInteractors(editor)).toMatchInlineSnapshot(
        `"α (F) 0/3/0 |>, β (I) <| 0/0/0, γ 0/0/1 |>, δ (I) 0/2, ε (I) 0/3/1 |>, ζ 1/0/1 |>, η (I) 0/5/1 |> ◉◀◀◀ 1/1/4 |>"`
      );
      expect(debugBlockSimple(editor.state.document, "0")).toMatchInlineSnapshot(`
        "
        HEADER ONE > TEXT {ITALIC} > \\"H1\\"
        HEADER ONE > TEXT {} > \\"MM\\"
        HEADER ONE > TEXT {} > \\"\\"
        HEADER ONE > TEXT {} > \\"NN\\"
        HEADER ONE > TEXT {} > \\"AA\\"
        HEADER ONE > TEXT {BOLD} > \\"BB\\""
      `);
      expect(debugBlockSimple(editor.state.document, "1")).toMatchInlineSnapshot(`
        "
        PARAGRAPH > TEXT {} > \\"CC\\"
        PARAGRAPH > URL_LINK g.com > \\"GOOGLE\\"
        PARAGRAPH > TEXT {} > \\"DD\\""
      `);
    });
  });

  describe("forwards", () => {
    it("basically works with one focused interactor", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.updateInteractor({ id: editor.state.focusedInteractor!.id, name: "α" }));
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

    it("works with multiple interactors being targeted", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.updateInteractor({ id: editor.state.focusedInteractor!.id, name: "α" }));
      editor.execute(OPS.jump({ to: { path: "1/2/0", orientation: After } }));
      editor.execute(OPS.addInteractor({ at: { path: "0/0/0", orientation: Before }, name: "β", status: Inactive }));
      editor.execute(OPS.addInteractor({ at: { path: "1/0/0", orientation: Before }, name: "γ", status: Active }));
      editor.execute(OPS.addInteractor({ at: { path: "1/1", orientation: On }, name: "δ", status: Inactive }));
      editor.execute(OPS.addInteractor({ at: { path: "1/2/1", orientation: After }, name: "ε", status: Inactive }));
      editor.execute(OPS.addInteractor({ at: { path: "3/0/1", orientation: After }, name: "ζ", status: Active }));

      editor.execute(
        OPS.addInteractor({
          at: { path: "2", orientation: After },
          selectTo: {
            path: "3/1/4",
            orientation: After,
          },
          status: Inactive,
          name: "η",
        })
      );
      editor.execute(OPS.joinBlocks({ target: TargetInteractors.AllActive, direction: FlowDirection.Forward }));
      expect(debugInteractors(editor)).toMatchInlineSnapshot(
        `"α (F) 1/2/0 |>, β (I) <| 0/0/0, γ <| 1/0/0, δ (I) 1/1, ε (I) 1/2/1 |>, ζ 2/0/1 |>, η (I) 1/4/1 |> ◉◀◀◀ 2/1/4 |>"`
      );
      expect(debugBlockSimple(editor.state.document, "0")).toMatchInlineSnapshot(`
        "
        HEADER ONE > TEXT {ITALIC} > \\"H1\\""
      `);
      expect(debugBlockSimple(editor.state.document, "1")).toMatchInlineSnapshot(`
        "
        PARAGRAPH > TEXT {} > \\"MM\\"
        PARAGRAPH > TEXT {} > \\"\\"
        PARAGRAPH > TEXT {} > \\"NN\\"
        PARAGRAPH > TEXT {} > \\"AA\\"
        PARAGRAPH > TEXT {BOLD} > \\"BB\\""
      `);
      expect(debugBlockSimple(editor.state.document, "2")).toMatchInlineSnapshot(`
              "
              PARAGRAPH > TEXT {} > \\"CC\\"
              PARAGRAPH > URL_LINK g.com > \\"GOOGLE\\"
              PARAGRAPH > TEXT {} > \\"DD\\""
          `);
    });
  });
});

describe("joinInlineText for multiple interactors", () => {
  it("basically works", () => {
    let editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.updateInteractor({ id: editor.state.focusedInteractor!.id, name: "α" }));
    editor.execute(OPS.jump({ to: { path: "1/3/0", orientation: After } }));
    editor.execute(
      OPS.addInteractor({ at: { path: "1/1", orientation: On }, name: "β", status: InteractorStatus.Active })
    );
    editor.execute(
      OPS.addInteractor({ at: { path: "1/2/0", orientation: After }, name: "γ", status: InteractorStatus.Active })
    );
    // other interactor 1 (inactive)
    editor.execute(
      OPS.addInteractor({ at: { path: "1/3/0", orientation: After }, name: "δ", status: InteractorStatus.Inactive })
    );
    // other interactor 2 (inactive)
    editor.execute(
      OPS.addInteractor({
        at: { path: "0/0/0", orientation: Before },
        selectTo: { path: "3/0/0", orientation: After },
        status: InteractorStatus.Inactive,
        name: "ε",
      })
    );
    editor.execute(OPS.joinInlineText({ target: TargetInteractors.AllActive, direction: FlowDirection.Backward }));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/0/4 |>
SLICE:  PARAGRAPH > TEXT {} > "MMNNAA"`);
    expect(debugInteractors(editor)).toMatchInlineSnapshot(
      `"α (F) 1/0/4 |>, β 1/0/1 |>, γ 1/0/2 |>, δ (I) 1/0/4 |>, ε (I) <| 0/0/0 ◉◀◀◀ 3/0/0 |>"`
    );

    editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.updateInteractor({ id: editor.state.focusedInteractor!.id, name: "α" }));
    editor.execute(OPS.jump({ to: { path: "1/1", orientation: On } }));
    editor.execute(
      OPS.addInteractor({ at: { path: "1/0/0", orientation: After }, name: "β", status: InteractorStatus.Active })
    );
    editor.execute(
      OPS.addInteractor({ at: { path: "1/2/0", orientation: After }, name: "γ", status: InteractorStatus.Active })
    );
    // other interactor 1 (inactive)
    editor.execute(
      OPS.addInteractor({ at: { path: "1/3/0", orientation: After }, name: "δ", status: InteractorStatus.Inactive })
    );
    // other interactor 2 (inactive)
    editor.execute(
      OPS.addInteractor({
        at: { path: "0/0/0", orientation: Before },
        selectTo: { path: "3/0/0", orientation: After },
        status: InteractorStatus.Inactive,
        name: "ε",
      })
    );
    editor.execute(OPS.joinInlineText({ target: TargetInteractors.AllActive, direction: FlowDirection.Forward }));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/0/1 |>
SLICE:  PARAGRAPH > TEXT {} > "MMNNAA"`);
    expect(debugInteractors(editor)).toMatchInlineSnapshot(
      `"α (F) 1/0/1 |>, β 1/0/0 |>, γ 1/0/2 |>, δ (I) 1/0/4 |>, ε (I) <| 0/0/0 ◉◀◀◀ 3/0/0 |>"`
    );
  });
});
