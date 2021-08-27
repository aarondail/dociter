import { CursorOrientation } from "../../src/cursor";
import { Editor, OPS, TargetInteractors } from "../../src/editor";
import { HeaderLevel } from "../../src/models";
import { FlowDirection, InteractorStatus } from "../../src/working-document";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { Before, After } = CursorOrientation;
const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugEditorStateLessSimple = DebugEditorHelpers.debugEditorStateLessSimple;
const debugInteractors = DebugEditorHelpers.debugInteractors;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"), inlineText("DD")),
  paragraph(inlineText("EE"), inlineText("FF")),
  paragraph(inlineText("GG"), inlineText("HH"))
);

describe("joinBlocks for selections and multiple interactors", () => {
  describe("backwards", () => {
    it("works when the selections overlap", () => {
      const editor = new Editor({ document: testDoc1, omitDefaultInteractor: true });
      // selection 1
      editor.execute(
        OPS.addInteractor({
          at: { path: "1/2/0", orientation: Before },
          selectTo: { path: "3/2/0", orientation: After },
          focused: true,
        })
      );
      // selection 2
      editor.execute(
        OPS.addInteractor({
          at: { path: "3/0/0", orientation: Before },
          selectTo: { path: "4/0/0", orientation: After },
        })
      );
      // other interactor 1 (inactive)
      editor.execute(
        OPS.addInteractor({ at: { path: "4/1/1", orientation: After }, status: InteractorStatus.Inactive })
      );
      // other interactor 2 (inactive)
      editor.execute(
        OPS.addInteractor({
          at: { path: "0/0/0", orientation: Before },
          selectTo: { path: "3/0/0", orientation: After },
          status: InteractorStatus.Inactive,
        })
      );
      // other interactor 3 (inactive)
      editor.execute(
        OPS.addInteractor({ at: { path: "5/0/0", orientation: Before }, status: InteractorStatus.Inactive })
      );

      editor.execute(OPS.joinBlocks({ target: TargetInteractors.AllActive, direction: FlowDirection.Backward }));
      expect(debugEditorStateLessSimple(editor)).toMatchInlineSnapshot(`
        "
        INTR. #1
        MAIN CURSOR: <| 1/2/0
        SLICE:  PARAGRAPH > TEXT {} > \\"NN\\"
        INTR. #1
        S.A. CURSOR: 1/7/0 |>
        SLICE:  PARAGRAPH > TEXT {} > \\"DDEE\\"

        INTR. #2
        MAIN CURSOR: 1/4/1 |>
        SLICE:  PARAGRAPH > TEXT {BOLD} > \\"BB\\"
        INTR. #2
        S.A. CURSOR: 1/7/2 |>
        SLICE:  PARAGRAPH > TEXT {} > \\"DDEE\\"

        INTR. #3
        CURSOR: 1/8/1 |>
        SLICE:  PARAGRAPH > TEXT {} > \\"FF\\"

        INTR. #4
        MAIN CURSOR: <| 0/0/0
        SLICE:  HEADER ONE > TEXT {} > \\"H1\\"
        INTR. #4
        S.A. CURSOR: 1/5/0 |>
        SLICE:  PARAGRAPH > TEXT {} > \\"CC\\"

        INTR. #5
        CURSOR: <| 2/0/0
        SLICE:  PARAGRAPH > TEXT {} > \\"GG\\""
      `);
    });
  });

  describe("forwards", () => {
    it("works when the selections overlap", () => {
      const editor = new Editor({ document: testDoc1, omitDefaultInteractor: true });
      // selection 1
      editor.execute(
        OPS.addInteractor({
          at: { path: "1/2/0", orientation: Before },
          selectTo: { path: "3/2/0", orientation: After },
          focused: true,
        })
      );
      // selection 2
      editor.execute(
        OPS.addInteractor({
          at: { path: "3/0/0", orientation: Before },
          selectTo: { path: "4/0/0", orientation: After },
        })
      );
      // other interactor 1 (inactive)
      editor.execute(
        OPS.addInteractor({ at: { path: "4/1/1", orientation: After }, status: InteractorStatus.Inactive })
      );
      // other interactor 2 (inactive)
      editor.execute(
        OPS.addInteractor({
          at: { path: "0/0/0", orientation: Before },
          selectTo: { path: "3/0/0", orientation: After },
          status: InteractorStatus.Inactive,
        })
      );
      // other interactor 3 (inactive)
      editor.execute(
        OPS.addInteractor({ at: { path: "5/0/0", orientation: Before }, status: InteractorStatus.Inactive })
      );

      editor.execute(OPS.joinBlocks({ target: TargetInteractors.AllActive, direction: FlowDirection.Forward }));
      expect(debugEditorStateLessSimple(editor)).toMatchInlineSnapshot(`
        "
        INTR. #1
        MAIN CURSOR: <| 1/2/0
        SLICE:  PARAGRAPH > TEXT {} > \\"NN\\"
        INTR. #1
        S.A. CURSOR: 1/7/0 |>
        SLICE:  PARAGRAPH > TEXT {} > \\"DDEE\\"

        INTR. #2
        MAIN CURSOR: 1/4/1 |>
        SLICE:  PARAGRAPH > TEXT {BOLD} > \\"BB\\"
        INTR. #2
        S.A. CURSOR: 1/7/2 |>
        SLICE:  PARAGRAPH > TEXT {} > \\"DDEE\\"

        INTR. #3
        CURSOR: 1/8/1 |>
        SLICE:  PARAGRAPH > TEXT {} > \\"FF\\"

        INTR. #4
        MAIN CURSOR: <| 0/0/0
        SLICE:  HEADER ONE > TEXT {} > \\"H1\\"
        INTR. #4
        S.A. CURSOR: 1/5/0 |>
        SLICE:  PARAGRAPH > TEXT {} > \\"CC\\"

        INTR. #5
        CURSOR: <| 2/0/0
        SLICE:  PARAGRAPH > TEXT {} > \\"GG\\""
      `);
    });
  });
});

describe("joinInlineText for selections and multiple interactor", () => {
  it("basically works", () => {
    let editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "1/0/0", orientation: After } }));
    editor.execute(OPS.jump({ to: { path: "1/4/0", orientation: After }, select: true }));
    // other interactor 1 (inactive)
    editor.execute(OPS.addInteractor({ at: { path: "1/3/0", orientation: After }, status: InteractorStatus.Inactive }));
    // other interactor 2 (inactive)
    editor.execute(
      OPS.addInteractor({
        at: { path: "0/0/0", orientation: Before },
        selectTo: { path: "3/0/0", orientation: After },
        status: InteractorStatus.Inactive,
      })
    );
    editor.execute(OPS.joinInlineText({ target: TargetInteractors.Focused, direction: FlowDirection.Backward }));
    expect(debugState(editor)).toEqual(`
MAIN CURSOR: 1/0/6 |>
SLICE:  PARAGRAPH > TEXT {} > "MMNNAABB"
S.A. CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "MMNNAABB"`);
    expect(debugInteractors(editor)).toMatchInlineSnapshot(
      `"(no-name, #1) (F) 1/0/0 |> ▶▶▶◉ 1/0/6 |>, (no-name, #2) (I) 1/0/4 |>, (no-name, #3) (I) <| 0/0/0 ◉◀◀◀ 3/0/0 |>"`
    );

    editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "1/0/0", orientation: After } }));
    editor.execute(OPS.jump({ to: { path: "1/4/0", orientation: After }, select: true }));
    // other interactor 1 (inactive)
    editor.execute(OPS.addInteractor({ at: { path: "1/3/0", orientation: After }, status: InteractorStatus.Inactive }));
    // other interactor 2 (inactive)
    editor.execute(
      OPS.addInteractor({
        at: { path: "0/0/0", orientation: Before },
        selectTo: { path: "3/0/0", orientation: After },
        status: InteractorStatus.Inactive,
      })
    );
    editor.execute(OPS.joinInlineText({ target: TargetInteractors.Focused, direction: FlowDirection.Forward }));
    expect(debugState(editor)).toEqual(`
MAIN CURSOR: 1/0/6 |>
SLICE:  PARAGRAPH > TEXT {BOLD} > "MMNNAABB"
S.A. CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {BOLD} > "MMNNAABB"`);
    expect(debugInteractors(editor)).toMatchInlineSnapshot(
      `"(no-name, #1) (F) 1/0/0 |> ▶▶▶◉ 1/0/6 |>, (no-name, #2) (I) 1/0/4 |>, (no-name, #3) (I) <| 0/0/0 ◉◀◀◀ 3/0/0 |>"`
    );
  });
});
