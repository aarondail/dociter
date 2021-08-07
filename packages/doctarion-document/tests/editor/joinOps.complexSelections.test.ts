import { CursorOrientation } from "../../src/cursor";
import { Editor, FlowDirection, OPS, TargetInteractors } from "../../src/editor";
import { InteractorStatus } from "../../src/editor/interactor";
import { HeaderLevel } from "../../src/models";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { Before, After } = CursorOrientation;
const debugEditorStateLessSimple = DebugEditorHelpers.debugEditorStateLessSimple;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"), inlineText("DD")),
  paragraph(inlineText("EE"), inlineText("FF")),
  paragraph(inlineText("GG"), inlineText("HH"))
);

describe("joinOps for selections and multiple interactors", () => {
  describe("backwards", () => {
    it("works when the selections overlap", () => {
      const editor = new Editor({ document: testDoc1, omitDefaultInteractor: true });
      // selection 1
      editor.execute(
        OPS.addInteractor({
          at: { path: "1/2/0", orientation: Before },
          selectionAnchor: { path: "3/2/0", orientation: After },
          focused: true,
        })
      );
      // selection 2
      editor.execute(
        OPS.addInteractor({
          at: { path: "3/0/0", orientation: Before },
          selectionAnchor: { path: "4/0/0", orientation: After },
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
          selectionAnchor: { path: "3/0/0", orientation: After },
          status: InteractorStatus.Inactive,
        })
      );
      // other interactor 3 (inactive)
      editor.execute(
        OPS.addInteractor({ at: { path: "5/0/0", orientation: Before }, status: InteractorStatus.Inactive })
      );

      editor.execute(OPS.joinBlocks({ target: TargetInteractors.AllActive, direction: FlowDirection.Backward }));
      expect(debugEditorStateLessSimple(editor)).toMatchInlineSnapshot(`
        "INTR. #1
        MAIN CURSOR: <| 0/0/0
        SLICE:  HEADER ONE > TEXT {} > \\"H1\\"INTR. #1
        S.A. CURSOR: 1/5/0 |>
        SLICE:  PARAGRAPH > TEXT {} > \\"CC\\"
        INTR. #2
        MAIN CURSOR: <| 1/2/0
        SLICE:  PARAGRAPH > TEXT {} > \\"NN\\"INTR. #2
        S.A. CURSOR: 1/7/0 |>
        SLICE:  PARAGRAPH > TEXT {} > \\"DD\\"
        INTR. #3
        MAIN CURSOR: <| 1/5/0
        SLICE:  PARAGRAPH > TEXT {} > \\"CC\\"INTR. #3
        S.A. CURSOR: 1/8/0 |>
        SLICE:  PARAGRAPH > TEXT {} > \\"EE\\"
        INTR. #4
        CURSOR: 1/9/1 |>
        SLICE:  PARAGRAPH > TEXT {} > \\"FF\\"
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
          selectionAnchor: { path: "3/2/0", orientation: After },
          focused: true,
        })
      );
      // selection 2
      editor.execute(
        OPS.addInteractor({
          at: { path: "3/0/0", orientation: Before },
          selectionAnchor: { path: "4/0/0", orientation: After },
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
          selectionAnchor: { path: "3/0/0", orientation: After },
          status: InteractorStatus.Inactive,
        })
      );
      // other interactor 3 (inactive)
      editor.execute(
        OPS.addInteractor({ at: { path: "5/0/0", orientation: Before }, status: InteractorStatus.Inactive })
      );

      editor.execute(OPS.joinBlocks({ target: TargetInteractors.AllActive, direction: FlowDirection.Forward }));
      expect(debugEditorStateLessSimple(editor)).toMatchInlineSnapshot(`
        "INTR. #1
        MAIN CURSOR: <| 0/0/0
        SLICE:  HEADER ONE > TEXT {} > \\"H1\\"INTR. #1
        S.A. CURSOR: 1/5/0 |>
        SLICE:  PARAGRAPH > TEXT {} > \\"CC\\"
        INTR. #2
        MAIN CURSOR: <| 1/2/0
        SLICE:  PARAGRAPH > TEXT {} > \\"NN\\"INTR. #2
        S.A. CURSOR: 1/7/0 |>
        SLICE:  PARAGRAPH > TEXT {} > \\"DD\\"
        INTR. #3
        MAIN CURSOR: <| 1/5/0
        SLICE:  PARAGRAPH > TEXT {} > \\"CC\\"INTR. #3
        S.A. CURSOR: 1/8/0 |>
        SLICE:  PARAGRAPH > TEXT {} > \\"EE\\"
        INTR. #4
        CURSOR: 1/9/1 |>
        SLICE:  PARAGRAPH > TEXT {} > \\"FF\\"
        INTR. #5
        CURSOR: <| 2/0/0
        SLICE:  PARAGRAPH > TEXT {} > \\"GG\\""
      `);
    });
  });
});
