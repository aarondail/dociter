import { CursorOrientation } from "../../src/cursor";
import { Editor, FlowDirection, InteractorStatus, OPS, TargetInteractors } from "../../src/editor";
import { HeaderLevel } from "../../src/models";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { Before, On, After } = CursorOrientation;
const { Inactive, Active } = InteractorStatus;

const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugCurrentBlock = DebugEditorHelpers.debugCurrentBlock;
const debugInteractorOrdering = DebugEditorHelpers.debugInteractorOrdering;
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
      editor.execute(OPS.jump({ to: { path: "1/2/0", orientation: After } }));
      editor.execute(OPS.addInteractor({ at: { path: "0/0/0", orientation: Before } }));
      editor.execute(OPS.addInteractor({ at: { path: "1/0/0", orientation: Before } }));
      editor.execute(OPS.addInteractor({ at: { path: "1/1", orientation: On } }));
      editor.execute(OPS.addInteractor({ at: { path: "1/2/1", orientation: After } }));
      editor.execute(OPS.addInteractor({ at: { path: "1/3/1", orientation: After } }));
      editor.execute(
        OPS.addInteractor({
          at: { path: "2", orientation: After },
          selectTo: {
            path: "3/1/4",
            orientation: After,
          },
        })
      );
      editor.execute(OPS.joinBlocks({ target: TargetInteractors.Focused, direction: FlowDirection.Backward }));
      expect(debugInteractorOrdering(editor)).toMatchInlineSnapshot(
        `"1.M <| 0/0/0, 2.M 0/0/1 |>, 3.M 0/2, 4.M (F) 0/3/0 |>, 5.M 0/3/1 |>, 6.M 0/4/1 |>, 7.M 1, 7.Sa 2/1/4 |>"`
      );
    });

    it("works with multiple interactors being targeted", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "1/2/0", orientation: After } }));
      editor.execute(OPS.addInteractor({ at: { path: "0/0/0", orientation: Before }, status: Inactive }));
      editor.execute(OPS.addInteractor({ at: { path: "1/0/0", orientation: Before }, status: Active }));
      editor.execute(OPS.addInteractor({ at: { path: "1/1", orientation: On }, status: Inactive }));
      editor.execute(OPS.addInteractor({ at: { path: "1/2/1", orientation: After }, status: Inactive }));
      editor.execute(OPS.addInteractor({ at: { path: "3/0/1", orientation: After }, status: Active }));
      editor.execute(
        OPS.addInteractor({
          at: { path: "2", orientation: After },
          selectTo: {
            path: "3/1/4",
            orientation: After,
          },
          status: Inactive,
        })
      );
      editor.execute(OPS.joinBlocks({ target: TargetInteractors.AllActive, direction: FlowDirection.Backward }));
      expect(debugInteractorOrdering(editor)).toMatchInlineSnapshot(
        `"1.M (I) <| 0/0/0, 2.M 0/0/1 |>, 3.M (I) 0/2, 4.M (F) 0/3/0 |>, 5.M (I) 0/3/1 |>, 6.M (I) <| 1/0/0, 7.M 1/0/1 |>, 6.Sa (I) 1/1/4 |>"`
      );
      expect(debugBlockSimple(editor.document, "0")).toMatchInlineSnapshot(`
        "
        HEADER ONE > TEXT {ITALIC} > \\"H1\\"
        HEADER ONE > TEXT {} > \\"MM\\"
        HEADER ONE > TEXT {} > \\"\\"
        HEADER ONE > TEXT {} > \\"NN\\"
        HEADER ONE > TEXT {} > \\"AA\\"
        HEADER ONE > TEXT {BOLD} > \\"BB\\""
      `);
      expect(debugBlockSimple(editor.document, "1")).toMatchInlineSnapshot(`
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
      editor.execute(OPS.jump({ to: { path: "1/2/0", orientation: After } }));
      editor.execute(OPS.addInteractor({ at: { path: "0/0/0", orientation: Before }, status: Inactive }));
      editor.execute(OPS.addInteractor({ at: { path: "1/0/0", orientation: Before }, status: Active }));
      editor.execute(OPS.addInteractor({ at: { path: "1/1", orientation: On }, status: Inactive }));
      editor.execute(OPS.addInteractor({ at: { path: "1/2/1", orientation: After }, status: Inactive }));
      editor.execute(OPS.addInteractor({ at: { path: "3/0/1", orientation: After }, status: Active }));
      editor.execute(
        OPS.addInteractor({
          at: { path: "2", orientation: After },
          selectTo: {
            path: "3/1/4",
            orientation: After,
          },
          status: Inactive,
        })
      );
      editor.execute(OPS.joinBlocks({ target: TargetInteractors.AllActive, direction: FlowDirection.Forward }));
      expect(debugInteractorOrdering(editor)).toMatchInlineSnapshot(
        `"1.M (I) <| 0/0/0, 2.M <| 1/0/0, 3.M (I) 1/1, 4.M (F) 1/2/0 |>, 5.M (I) 1/2/1 |>, 6.M (I) 1/4/1 |>, 7.M 2/0/1 |>, 6.Sa (I) 2/1/4 |>"`
      );
      expect(debugBlockSimple(editor.document, "0")).toMatchInlineSnapshot(`
        "
        HEADER ONE > TEXT {ITALIC} > \\"H1\\""
      `);
      expect(debugBlockSimple(editor.document, "1")).toMatchInlineSnapshot(`
        "
        PARAGRAPH > TEXT {} > \\"MM\\"
        PARAGRAPH > TEXT {} > \\"\\"
        PARAGRAPH > TEXT {} > \\"NN\\"
        PARAGRAPH > TEXT {} > \\"AA\\"
        PARAGRAPH > TEXT {BOLD} > \\"BB\\""
      `);
      expect(debugBlockSimple(editor.document, "2")).toMatchInlineSnapshot(`
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
    editor.execute(OPS.jump({ to: { path: "1/3/0", orientation: After } }));
    editor.execute(OPS.addInteractor({ at: { path: "1/1", orientation: On }, status: InteractorStatus.Active }));
    editor.execute(OPS.addInteractor({ at: { path: "1/2/0", orientation: After }, status: InteractorStatus.Active }));
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
    editor.execute(OPS.joinInlineText({ target: TargetInteractors.AllActive, direction: FlowDirection.Backward }));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/0/4 |>
SLICE:  PARAGRAPH > TEXT {} > "MMNNAA"`);
    expect(debugInteractorOrdering(editor)).toMatchInlineSnapshot(
      `"1.M (I) <| 0/0/0, 2.M 1/0/2 |>, 3.M (F) 1/0/4 |>, 4.M (I) 1/0/4 |>, 1.Sa (I) 3/0/0 |>"`
    );

    editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "1/1", orientation: On } }));
    editor.execute(OPS.addInteractor({ at: { path: "1/0/0", orientation: After }, status: InteractorStatus.Active }));
    editor.execute(OPS.addInteractor({ at: { path: "1/2/0", orientation: After }, status: InteractorStatus.Active }));
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
    editor.execute(OPS.joinInlineText({ target: TargetInteractors.AllActive, direction: FlowDirection.Forward }));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/0/1 |>
SLICE:  PARAGRAPH > TEXT {} > "MMNNAA"`);
    expect(debugInteractorOrdering(editor)).toMatchInlineSnapshot(
      `"1.M (I) <| 0/0/0, 2.M 1/0/0 |>, 3.M (F) 1/0/1 |>, 4.M 1/0/2 |>, 5.M (I) 1/0/4 |>, 1.Sa (I) 3/0/0 |>"`
    );
  });
});
