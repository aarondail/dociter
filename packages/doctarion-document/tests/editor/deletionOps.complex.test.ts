import { CursorOrientation } from "../../src/cursor";
import { Editor, OPS, TargetInteractors } from "../../src/editor";
import { HeaderLevel } from "../../src/models";
import { FlowDirection } from "../../src/working-document";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { After } = CursorOrientation;
const debugState = DebugEditorHelpers.debugEditorStateLessSimple;
const debugBlockSimple = DebugEditorHelpers.debugBlockSimple;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"), inlineText("DD"))
);

describe("deleteAt with multiple interactors", () => {
  describe("backwards", () => {
    it("three pretty unrelated targeted interactors are updated appropriately", () => {
      const editor = new Editor({ document: testDoc1, omitDefaultInteractor: true });
      editor.execute(OPS.addInteractor({ at: { path: "0/0/1", orientation: After } }));
      editor.execute(OPS.addInteractor({ at: { path: "1/2/0", orientation: After } }));
      editor.execute(OPS.addInteractor({ at: { path: "3/1/0", orientation: After } }));
      editor.execute(OPS.deleteAt({ target: TargetInteractors.All, direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
INTR. #1
CURSOR: 0/0/0 |>
SLICE:  HEADER ONE > TEXT {} > "H"

INTR. #2
CURSOR: <| 1/2/0
SLICE:  PARAGRAPH > TEXT {} > "N"

INTR. #3
CURSOR: <| 3/1/0
SLICE:  PARAGRAPH > URL_LINK g.com > "OOGLE"`);

      editor.execute(
        OPS.deleteAt({
          target: TargetInteractors.All,
          direction: FlowDirection.Backward,
          allowAdjacentInlineTextDeletion: true,
        })
      );
      // 1) deletes final character in InlineText, then InlineText itself 2) deletes prior empty inline text, 3) no-op
      // Note 2 only works because of the passed option
      expect(debugState(editor)).toEqual(`
INTR. #1
CURSOR: 0
SLICE:  HEADER ONE

INTR. #2
CURSOR: <| 1/1/0
SLICE:  PARAGRAPH > TEXT {} > "N"

INTR. #3
CURSOR: <| 3/1/0
SLICE:  PARAGRAPH > URL_LINK g.com > "OOGLE"`);

      editor.execute(OPS.deleteAt({ target: TargetInteractors.All, direction: FlowDirection.Backward }));
      // 1) first header is deleted, cursor now on MM, 2) deletes character from prior InlineText, 3) no-op
      expect(debugState(editor)).toEqual(`
INTR. #1
CURSOR: <| 0/0/0
SLICE:  PARAGRAPH > TEXT {} > "M"

INTR. #2
CURSOR: <| 0/1/0
SLICE:  PARAGRAPH > TEXT {} > "N"

INTR. #3
CURSOR: <| 2/1/0
SLICE:  PARAGRAPH > URL_LINK g.com > "OOGLE"`);
    });

    it("three targeted related interactors are all updated appropriately", () => {
      const editor = new Editor({ document: testDoc1, omitDefaultInteractor: true });
      editor.execute(OPS.addInteractor({ at: { path: "3/1/1", orientation: After } }));
      editor.execute(OPS.addInteractor({ at: { path: "3/1/3", orientation: After } }));
      editor.execute(OPS.addInteractor({ at: { path: "3/1/5", orientation: After } }));
      editor.execute(OPS.deleteAt({ target: TargetInteractors.All, direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
INTR. #1
CURSOR: 3/1/0 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOL"

INTR. #2
CURSOR: 3/1/1 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOL"

INTR. #3
CURSOR: 3/1/2 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOL"`);

      editor.execute(OPS.deleteAt({ target: TargetInteractors.All, direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
INTR. #1
CURSOR: 3/1
SLICE:  PARAGRAPH > URL_LINK g.com > ""`);

      editor.execute(OPS.deleteAt({ target: TargetInteractors.All, direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
INTR. #1
CURSOR: 3/0/1 |>
SLICE:  PARAGRAPH > TEXT {} > "CC"`);
      expect(debugBlockSimple(editor.state.document, "3")).toEqual(`
PARAGRAPH > TEXT {} > "CC"
PARAGRAPH > TEXT {} > "DD"`);
    });

    // it("overlapping targetted interactors are all updated and deduped", () => {});
    // it("targetted and non-targetted interactors are all updated appropriately", () => {});
    // it("overlapping targetted and non-targeted interactors are all updated and deduped", () => {});
    // it("three very close targetted interactors are updated appropriately", () => {
    // it("selection anchors are updated too", () => {
    // it("if a deleteion causes a interactor's two cursors to combine it is no longer a selection acnhor", () => {
  });

  describe("forwards", () => {
    // fit("three pretty unrelated targetted interactors are updated appropriately", () => {
    //   const editor = new Editor({ document: testDoc1, omitDefaultInteractor: true });
    //   editor.update(OPS.addInteractor({ at: { path: "0/0/0", orientation: After } }));
    //   const id2 = editor.update(OPS.addInteractor({ at: { path: "1/2/0", orientation: After } }));
    //   editor.update(OPS.addInteractor({ at: { path: "3/1/0", orientation: After } }));
    //   editor.update(OPS.deleteAt({ target: TargetInteractors.All, direction: DeleteAtDirection.Forward }));
    //   expect(debugState(editor)).toEqual(`INTR. #1
    // CURSOR: 0/0/0 |>
    // SLICE:  HEADER ONE > TEXT {} > "H"
    // INTR. #2
    // CURSOR: 1/2/0 |>
    // SLICE:  PARAGRAPH > TEXT {} > "N"
    // INTR. #3
    // CURSOR: 3/1/0 |>
    // SLICE:  PARAGRAPH > URL_LINK g.com > "GOGLE"`);
    //   // TODO copy more, but it will require support for joining paragraphs and stuff
    //   // which we don't support yet
    // });
    // it("three targetted related interactors are all updated appropriately", () => {});
    // it("overlapping targetted interactors are all updated and deduped", () => {});
    // it("targetted and non-targetted interactors are all updated appropriately", () => {});
    // it("overlapping targetted and non-targeted interactors are all updated and deduped", () => {});
    // it("three very close targetted interactors are updated appropriately", () => {
    // it("selection anchors are updated too", () => {
    // it("if a deleteion causes a interactor's two cursors to combine it is no longer a selection acnhor", () => {
  });
});
