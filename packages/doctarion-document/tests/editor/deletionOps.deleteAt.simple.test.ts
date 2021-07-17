import { CursorOrientation } from "../../src/cursor";
import { Editor, OPS, TargetInteractors } from "../../src/editor";
import { DeleteAtDirection } from "../../src/editor/deletionOps";
import { HeaderLevel } from "../../src/models";
import { DebugEditorHelpers, doc, header, inlineEmoji, inlineText, inlineUrlLink, paragraph } from "../utils";

const { Before, On, After } = CursorOrientation;
const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugCurrentBlock = DebugEditorHelpers.debugCurrentBlock;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"), inlineText("DD"))
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

    it("stops at the beginning of the doc", () => {
      let editor = new Editor({ document: testDoc1 });
      editor.update(OPS.jump({ to: { path: "0/0/0", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0/0
SLICE:  HEADER ONE > TEXT {} > "1"`);

      // This is a no-op
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0/0
SLICE:  HEADER ONE > TEXT {} > "1"`);

      editor = new Editor({ document: testDoc1 });
      editor.update(OPS.jump({ to: { path: "0/0/1", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0
SLICE:  HEADER ONE`);

      // This is not a no-op and deletes the empty paragraph we were at
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0/0
SLICE:  PARAGRAPH > TEXT {} > "MM"`);
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

      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));

      // Make sure there is nothing to the right
      editor.resetHistory();
      editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
      expect(editor.history).toHaveLength(0);
    });

    it("will delete inline emoji directly", () => {
      const editor = new Editor({ document: doc(paragraph(inlineText("AB"), inlineEmoji("tree"), inlineText("CD"))) });
      editor.update(OPS.jump({ to: { path: "0/1", orientation: On } }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/1
SLICE:  PARAGRAPH > EMOJI tree`);

      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  PARAGRAPH > TEXT {} > "AB"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "AB"
PARAGRAPH > TEXT {} > "CD"`);
    });

    //     xit("will delete inline emoji indirectly when cursor is adjacent", () => {
    //       const editor = new Editor({ document: doc(paragraph(inlineText("AB"), inlineEmoji("tree"), inlineText("CD"))) });
    //       editor.update(OPS.jump({ to: { path: "0/2/0", orientation: Before } }));
    //       expect(debugState(editor)).toEqual(`
    // CURSOR: <| 0/2/0
    // SLICE:  PARAGRAPH > TEXT {} > "CD"`);

    //       editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Backward }));
    //       expect(debugState(editor)).toEqual(`
    // CURSOR: <| 0/1/0
    // SLICE:  PARAGRAPH > TEXT {} > "CD"`);
    //       expect(debugCurrentBlock(editor)).toEqual(`
    // PARAGRAPH > TEXT {} > "AB"
    // PARAGRAPH > TEXT {} > "CD"`);
    //     });
    //     xit("will join paragraphs", () => {});
    //     xit("will paragraph into header and header into paragraph", () => {});
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

    it("stops at the end of the doc", () => {
      let editor = new Editor({ document: testDoc1 });
      editor.update(OPS.jump({ to: { path: "3/2/0", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 3/2/0 |>
SLICE:  PARAGRAPH > TEXT {} > "D"`);
      // This is a no-op
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 3/2/0 |>
SLICE:  PARAGRAPH > TEXT {} > "D"`);

      editor = new Editor({ document: doc(header(HeaderLevel.One, inlineText("H1")), paragraph(inlineText("A"))) });
      editor.update(OPS.jump({ to: { path: "1/0/0", orientation: Before } }));
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      // This is not a no-op and deletes the empty paragraph we were at
      editor.update(OPS.deleteAt({ direction: DeleteAtDirection.Foreward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);
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

    //     xit("will not delete inline emoji directly", () => {});
    //     xit("will not delete inline emoji indirectly when cursor is adjacent", () => {});
    //     xit("will join paragraphs", () => {});
    //     xit("will paragraph into header and header into paragraph", () => {});
  });
});
