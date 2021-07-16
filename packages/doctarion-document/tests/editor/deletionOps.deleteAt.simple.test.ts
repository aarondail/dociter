import { CursorOrientation } from "../../src/cursor";
import { Editor, OPS, TargetInteractors } from "../../src/editor";
import { DeleteAtDirection } from "../../src/editor/deletionOps";
import { HeaderLevel } from "../../src/models";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { On, After } = CursorOrientation;
const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugCurrentBlock = DebugEditorHelpers.debugCurrentBlock;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"), inlineText("DD")),
  header(HeaderLevel.One)
);

describe("deleteAt for a single interactor", () => {
  describe("backwards", () => {
    it("basically works", () => {
      const editor = new Editor({ document: testDoc1 });
      // Jump to L in the "GOOGLE" text of the url link
      // Note the cursor would be at: GOOG|LE
      editor.update(OPS.jump({ to: { path: "3/1/3", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 3/1/2 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOLE"`);

      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 3/1/1 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOLE"`);
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 3/1/0 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GLE"`);
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 3/1/0
SLICE:  PARAGRAPH > URL_LINK g.com > "LE"`);

      // This should be a no-op
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 3/1/0
SLICE:  PARAGRAPH > URL_LINK g.com > "LE"`);
    });

    it("deletes through InlineText and removes empty InlineText", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.update(OPS.jump({ to: { path: "1/3/1", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/3/0 |>
SLICE:  PARAGRAPH > TEXT {} > "A"`);

      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/2/1 |>
SLICE:  PARAGRAPH > TEXT {} > "NN"`);

      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/1
SLICE:  PARAGRAPH > TEXT {} > ""`);

      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/1 |>
SLICE:  PARAGRAPH > TEXT {} > "MM"`);

      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MM"
PARAGRAPH > TEXT {BOLD} > "BB"`);
    });

    //     fit("deletes through InlineText xxx", () => {
    //       const editor = new Editor({ document: testDoc1 });
    //       editor.update(OPS.jump({ to: { path: "1/3/0", orientation: CursorOrientation.Before } }));
    //       expect(debugState(editor)).toMatchInlineSnapshot(`
    //         "
    //         CURSOR: 1/2/1 |>
    //         SLICE:  PARAGRAPH > TEXT {} > \\"NN\\""
    //       `);
    //       editor.update(OPS.moveForward({}));
    //       expect(debugState(editor)).toMatchInlineSnapshot(`
    //         "
    //         CURSOR: 1/3/0 |>
    //         SLICE:  PARAGRAPH > TEXT {} > \\"AA\\""
    //       `);
    //       editor.update(OPS.moveBack({}));
    //       expect(debugState(editor)).toMatchInlineSnapshot(`
    //         "
    //         CURSOR: 1/2/1 |>
    //         SLICE:  PARAGRAPH > TEXT {} > \\"NN\\""
    //       `);

    //       editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
    //       expect(debugState(editor)).toMatchInlineSnapshot(`
    //         "
    //         CURSOR: 1/2/0 |>
    //         SLICE:  PARAGRAPH > TEXT {} > \\"N\\""
    //       `);
    //       expect(debugCurrentBlock(editor)).toMatchInlineSnapshot(`
    //         "
    //         PARAGRAPH > TEXT {} > \\"MM\\"
    //         PARAGRAPH > TEXT {} > \\"\\"
    //         PARAGRAPH > TEXT {} > \\"N\\"
    //         PARAGRAPH > TEXT {} > \\"AA\\"
    //         PARAGRAPH > TEXT {BOLD} > \\"BB\\""
    //       `);
    //     });

    it("from an empty inline text it works ok", () => {
      const editor = new Editor({ document: testDoc1 });

      editor.update(OPS.jump({ to: { path: "1/1", orientation: On } }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/1
SLICE:  PARAGRAPH > TEXT {} > ""`);

      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/1 |>
SLICE:  PARAGRAPH > TEXT {} > "MM"`);

      // Note A was deleted
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MM"
PARAGRAPH > TEXT {} > "NN"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"`);
    });

    it("will delete empty paragraph block for cursor with before orientation", () => {
      const d = doc(header(HeaderLevel.One, inlineText("H1")), paragraph());
      const editor = new Editor({ document: d });
      editor.update(OPS.jump({ to: { path: "1", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);

      // Make sure there is nothing to the right
      editor.resetHistory();
      editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
      expect(editor.history).toHaveLength(0);
    });

    it("will delete empty paragraph block after empty inline text", () => {
      const d = doc(header(HeaderLevel.One, inlineText("H1")), paragraph(inlineText("")));
      const editor = new Editor({ document: d });
      editor.update(OPS.jump({ to: { path: "1/0", orientation: On } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1
SLICE:  PARAGRAPH`);

      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);

      // Make sure there is nothing to the right
      editor.resetHistory();
      editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
      expect(editor.history).toHaveLength(0);
    });

    it("will delete empty paragraph block after empty inline url link", () => {
      const d = doc(header(HeaderLevel.One, inlineText("H1")), paragraph(inlineUrlLink("g.com", "")));
      const editor = new Editor({ document: d });
      editor.update(OPS.jump({ to: { path: "1/0", orientation: On } }));
      // This deletes the empty inline url link
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      // But should leave the cursor on the paragraph
      expect(debugState(editor)).toEqual(`
CURSOR: 1
SLICE:  PARAGRAPH`);

      // This should delete the paragraph
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      // Moving the cursor to the header
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);

      // Make sure there is nothing to the right
      editor.resetHistory();
      editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
      expect(editor.history).toHaveLength(0);
    });

    it("will delete empty header block", () => {
      const d = doc(header(HeaderLevel.One, inlineText("H1")), header(HeaderLevel.Two));
      const editor = new Editor({ document: d });
      editor.update(OPS.jump({ to: { path: "1", orientation: On } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);

      // Make sure there is nothing to the right
      editor.resetHistory();
      editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
      expect(editor.history).toHaveLength(0);
    });

    it("will delete empty inline url link", () => {
      const d = doc(
        header(HeaderLevel.One, inlineText("H1")),
        paragraph(inlineText("ASD"), inlineUrlLink("g.com", ""))
      );
      const editor = new Editor({ document: d });
      editor.update(OPS.jump({ to: { path: "1/1", orientation: On } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/2 |>
SLICE:  PARAGRAPH > TEXT {} > "ASD"`);

      // Make sure there is nothing to the right
      editor.resetHistory();
      editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
      expect(editor.history).toHaveLength(0);
    });

    it("will delete empty inline text", () => {
      const d = doc(header(HeaderLevel.One, inlineText("H1")), paragraph(inlineText("ASD"), inlineText("")));
      const editor = new Editor({ document: d });
      editor.update(OPS.jump({ to: { path: "1/1", orientation: On } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/2 |>
SLICE:  PARAGRAPH > TEXT {} > "ASD"`);

      // Make sure there is nothing to the right
      editor.resetHistory();
      editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
      expect(editor.history).toHaveLength(0);
    });

    it("will not delete document", () => {
      const d = doc();
      const editor = new Editor({ document: d });
      editor.update(OPS.jump({ to: { path: "", orientation: On } }));

      // Make sure there is nothing to the right
      editor.resetHistory();
      editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
      expect(editor.history).toHaveLength(0);
    });
  });

  describe("forwards", () => {
    it("basically works", () => {
      const editor = new Editor({ document: testDoc1 });
      // Jump to L in the "GOOGLE" text of the url link
      // Note the cursor would be at: GOOG|LE
      editor.update(OPS.jump({ to: { path: "3/1/3", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 3/1/3 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGE"`);

      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 3/1/3 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOG"`);
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      // This should be a no-op
      expect(debugState(editor)).toEqual(`
CURSOR: 3/1/3 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOG"`);
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
    });

    it("deletes through InlineText and removes empty InlineText", () => {
      //     paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
      const editor = new Editor({ document: testDoc1 });
      editor.update(OPS.jump({ to: { path: "1/0/0", orientation: CursorOrientation.After } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "M"`);

      // This looks like a no-op but its not
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "M"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "M"
PARAGRAPH > TEXT {} > "NN"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"`);

      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "M"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "M"
PARAGRAPH > TEXT {} > "N"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"`);
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "M"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "M"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"`);
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "M"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "M"
PARAGRAPH > TEXT {} > "A"
PARAGRAPH > TEXT {BOLD} > "BB"`);

      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));

      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "M"
PARAGRAPH > TEXT {BOLD} > "B"`);
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "M"`);

      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "M"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "M"`);
    });

    it("from an empty inline text it works ok", () => {
      const editor = new Editor({ document: testDoc1 });

      editor.update(OPS.jump({ to: { path: "1/1", orientation: On } }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/1
SLICE:  PARAGRAPH > TEXT {} > ""`);

      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      // This isn't on the NN InlineText because we prefer after affinity to before generally
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/1 |>
SLICE:  PARAGRAPH > TEXT {} > "MM"`);

      // Note A was deleted
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MM"
PARAGRAPH > TEXT {} > "NN"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"`);
    });

    it("will delete empty paragraph block for cursor with before orientation", () => {
      const d = doc(header(HeaderLevel.One, inlineText("H1")), paragraph());
      const editor = new Editor({ document: d });
      editor.update(OPS.jump({ to: { path: "1", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);

      // Make sure there is nothing to the right
      editor.resetHistory();
      editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
      expect(editor.history).toHaveLength(0);
    });

    it("will delete empty paragraph block after empty inline text", () => {
      const d = doc(header(HeaderLevel.One, inlineText("H1")), paragraph(inlineText("")));
      const editor = new Editor({ document: d });
      editor.update(OPS.jump({ to: { path: "1/0", orientation: On } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1
SLICE:  PARAGRAPH`);

      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);

      // Make sure there is nothing to the right
      editor.resetHistory();
      editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
      expect(editor.history).toHaveLength(0);
    });

    it("will delete empty paragraph block after empty inline url link", () => {
      const d = doc(header(HeaderLevel.One, inlineText("H1")), paragraph(inlineUrlLink("g.com", "")));
      const editor = new Editor({ document: d });
      editor.update(OPS.jump({ to: { path: "1/0", orientation: On } }));
      // This deletes the empty inline url link
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      // But should leave the cursor on the paragraph
      expect(debugState(editor)).toEqual(`
CURSOR: 1
SLICE:  PARAGRAPH`);

      // This should delete the paragraph
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      // Moving the cursor to the header
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);

      // Make sure there is nothing to the right
      editor.resetHistory();
      editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
      expect(editor.history).toHaveLength(0);
    });

    it("will delete empty header block", () => {
      const d = doc(header(HeaderLevel.One, inlineText("H1")), header(HeaderLevel.Two));
      const editor = new Editor({ document: d });
      editor.update(OPS.jump({ to: { path: "1", orientation: On } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);

      // Make sure there is nothing to the right
      editor.resetHistory();
      editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
      expect(editor.history).toHaveLength(0);
    });

    it("will delete empty inline url link", () => {
      const d = doc(
        header(HeaderLevel.One, inlineText("H1")),
        paragraph(inlineText("ASD"), inlineUrlLink("g.com", ""))
      );
      const editor = new Editor({ document: d });
      editor.update(OPS.jump({ to: { path: "1/1", orientation: On } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/2 |>
SLICE:  PARAGRAPH > TEXT {} > "ASD"`);

      // Make sure there is nothing to the right
      editor.resetHistory();
      editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
      expect(editor.history).toHaveLength(0);
    });

    it("will delete empty inline text", () => {
      const d = doc(header(HeaderLevel.One, inlineText("H1")), paragraph(inlineText("ASD"), inlineText("")));
      const editor = new Editor({ document: d });
      editor.update(OPS.jump({ to: { path: "1/1", orientation: On } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/2 |>
SLICE:  PARAGRAPH > TEXT {} > "ASD"`);

      // Make sure there is nothing to the right
      editor.resetHistory();
      editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
      expect(editor.history).toHaveLength(0);
    });
  });
});
