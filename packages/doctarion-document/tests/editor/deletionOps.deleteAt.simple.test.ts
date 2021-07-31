import { CursorOrientation } from "../../src/cursor";
import { Editor, FlowDirection, OPS, TargetInteractors } from "../../src/editor";
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
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 3/1/2 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOLE"`);

      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 3/1/1 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOLE"`);
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 3/1/0 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GLE"`);
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 3/1/0
SLICE:  PARAGRAPH > URL_LINK g.com > "LE"`);

      // This should be a no-op
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 3/1/0
SLICE:  PARAGRAPH > URL_LINK g.com > "LE"`);
    });

    it("stops at the beginning of the doc", () => {
      let editor = new Editor({ document: testDoc1 });
      editor.update(OPS.jump({ to: { path: "0/0/0", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0/0
SLICE:  HEADER ONE > TEXT {} > "1"`);

      // This is a no-op
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0/0
SLICE:  HEADER ONE > TEXT {} > "1"`);

      editor = new Editor({ document: testDoc1 });
      editor.update(OPS.jump({ to: { path: "0/0/1", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0
SLICE:  HEADER ONE`);

      // This is not a no-op and deletes the empty paragraph we were at
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0/0
SLICE:  PARAGRAPH > TEXT {} > "MM"`);
    });

    it("delete removes empty InlineText", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.update(OPS.jump({ to: { path: "1/3/1", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/3/0 |>
SLICE:  PARAGRAPH > TEXT {} > "A"`);

      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/2/1 |>
SLICE:  PARAGRAPH > TEXT {} > "NN"`);

      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/1
SLICE:  PARAGRAPH > TEXT {} > ""`);

      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/1 |>
SLICE:  PARAGRAPH > TEXT {} > "MM"`);

      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MM"
PARAGRAPH > TEXT {BOLD} > "BB"`);
    });

    it("does not delete through InlineTexts", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.update(OPS.jump({ to: { path: "1/0/0", orientation: Before } }));
      // This should be a no-op
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 1/0/0
SLICE:  PARAGRAPH > TEXT {} > "MM"`);
    });

    it("does move through an InlineText with the proper options set", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.update(OPS.jump({ to: { path: "1/0/0", orientation: Before } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward, allowMovementInBoundaryCases: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);
    });

    it("from an empty inline text it works ok", () => {
      const editor = new Editor({ document: testDoc1 });

      editor.update(OPS.jump({ to: { path: "1/1", orientation: On } }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/1
SLICE:  PARAGRAPH > TEXT {} > ""`);

      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
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
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
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
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1
SLICE:  PARAGRAPH`);

      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
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
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      // But should leave the cursor on the paragraph
      expect(debugState(editor)).toEqual(`
CURSOR: 1
SLICE:  PARAGRAPH`);

      // This should delete the paragraph
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
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
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
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
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
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
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
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

      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));

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

      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  PARAGRAPH > TEXT {} > "AB"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "AB"
PARAGRAPH > TEXT {} > "CD"`);
    });

    it("will move to inline emoji with the proper options", () => {
      const editor = new Editor({
        document: doc(
          paragraph(inlineEmoji("a"), inlineEmoji("b"), inlineText("CD"), inlineEmoji("c"), inlineUrlLink("G.com", "G"))
        ),
      });
      editor.update(OPS.jump({ to: { path: "0/2/0", orientation: Before } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward, allowMovementInBoundaryCases: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/1
SLICE:  PARAGRAPH > EMOJI b`);

      editor.update(OPS.jump({ to: { path: "0/0", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward, allowMovementInBoundaryCases: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0
SLICE:  PARAGRAPH > EMOJI a`);

      editor.update(OPS.jump({ to: { path: "0/4", orientation: Before } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward, allowMovementInBoundaryCases: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/3
SLICE:  PARAGRAPH > EMOJI c`);
    });

    it("will delete multiple emoji", () => {
      const editor = new Editor({
        document: doc(paragraph(inlineText("AB"), inlineEmoji("turtle"), inlineEmoji("tree"), inlineText("CD"))),
      });
      editor.update(OPS.jump({ to: { path: "0/2", orientation: On } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward, allowMovementInBoundaryCases: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/1
SLICE:  PARAGRAPH > EMOJI turtle`);
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward, allowMovementInBoundaryCases: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  PARAGRAPH > TEXT {} > "AB"`);
    });

    it("will delete inline emoji indirectly when cursor is adjacent with proper options", () => {
      let editor = new Editor({ document: doc(paragraph(inlineEmoji("first"), inlineText("AB"))) });
      editor.update(OPS.jump({ to: { path: "0/1/0", orientation: Before } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward, allowAdjacentInlineEmojiDeletion: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0/0
SLICE:  PARAGRAPH > TEXT {} > "AB"`);

      editor = new Editor({ document: doc(paragraph(inlineEmoji("first"), inlineEmoji("second"))) });
      editor.update(OPS.jump({ to: { path: "0/1", orientation: Before } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward, allowAdjacentInlineEmojiDeletion: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0
SLICE:  PARAGRAPH > EMOJI second`);

      editor = new Editor({ document: doc(paragraph(inlineEmoji("first"), inlineUrlLink("G.com", "GOOGLE"))) });
      editor.update(OPS.jump({ to: { path: "0/1", orientation: Before } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward, allowAdjacentInlineEmojiDeletion: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0
SLICE:  PARAGRAPH > URL_LINK G.com > "GOOGLE"`);
    });

    it("will not delete inline emoji by default from in-between insertion points", () => {
      const editor = new Editor({
        document: doc(
          paragraph(inlineEmoji("turtle"), inlineEmoji("tree"), inlineUrlLink("G.com", "GOOGLE"), inlineEmoji("end"))
        ),
      });

      // The deletions in here should all be no-ops
      editor.update(OPS.jump({ to: { path: "0/3", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/3 |>
SLICE:  PARAGRAPH > EMOJI end`);

      editor.update(OPS.jump({ to: { path: "0/1", orientation: Before } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Backward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0 |>
SLICE:  PARAGRAPH > EMOJI turtle`);

      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > EMOJI turtle
PARAGRAPH > EMOJI tree
PARAGRAPH > URL_LINK G.com > "GOOGLE"
PARAGRAPH > EMOJI end`);
    });

    //     xit("will join paragraphs", () => {});
    //     xit("will paragraph into header and header into paragraph", () => {});
  });

  describe("forwards", () => {
    it("basically works", () => {
      const editor = new Editor({ document: testDoc1 });
      // Jump to L in the "GOOGLE" text of the url link
      // Note the cursor would be at: GOOG|LE
      editor.update(OPS.jump({ to: { path: "3/1/3", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 3/1/3 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOGE"`);

      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 3/1/3 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOG"`);
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
      // This should be a no-op
      expect(debugState(editor)).toEqual(`
CURSOR: 3/1/3 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOG"`);
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
    });

    it("stops at the end of the doc", () => {
      let editor = new Editor({ document: testDoc1 });
      editor.update(OPS.jump({ to: { path: "3/2/0", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 3/2/0 |>
SLICE:  PARAGRAPH > TEXT {} > "D"`);
      // This is a no-op
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 3/2/0 |>
SLICE:  PARAGRAPH > TEXT {} > "D"`);

      editor = new Editor({ document: doc(header(HeaderLevel.One, inlineText("H1")), paragraph(inlineText("A"))) });
      editor.update(OPS.jump({ to: { path: "1/0/0", orientation: Before } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
      // This is not a no-op and deletes the empty paragraph we were at
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);
    });

    it("does not delete through InlineText", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.update(OPS.jump({ to: { path: "1/0/0", orientation: CursorOrientation.After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "M"`);

      // This should be a no-op
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "M"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "M"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "NN"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"`);
    });

    it("does move through an InlineText with the proper options set", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.update(OPS.jump({ to: { path: "0/0/1", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowMovementInBoundaryCases: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 1/0/0
SLICE:  PARAGRAPH > TEXT {} > "MM"`);
    });

    it("deletes through InlineText and removes empty InlineText with proper options set", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.update(OPS.jump({ to: { path: "1/0/0", orientation: CursorOrientation.After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowAdjacentInlineTextDeletion: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "M"`);

      // This looks like a no-op but its not
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowAdjacentInlineTextDeletion: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "M"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "M"
PARAGRAPH > TEXT {} > "NN"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"`);

      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowAdjacentInlineTextDeletion: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "M"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "M"
PARAGRAPH > TEXT {} > "N"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"`);
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowAdjacentInlineTextDeletion: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "M"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "M"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"`);
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowAdjacentInlineTextDeletion: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "M"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "M"
PARAGRAPH > TEXT {} > "A"
PARAGRAPH > TEXT {BOLD} > "BB"`);

      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowAdjacentInlineTextDeletion: true }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowAdjacentInlineTextDeletion: true }));

      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "M"
PARAGRAPH > TEXT {BOLD} > "B"`);
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowAdjacentInlineTextDeletion: true }));
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "M"`);

      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowAdjacentInlineTextDeletion: true }));
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

      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
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
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
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
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1
SLICE:  PARAGRAPH`);

      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
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
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
      // But should leave the cursor on the paragraph
      expect(debugState(editor)).toEqual(`
CURSOR: 1
SLICE:  PARAGRAPH`);

      // This should delete the paragraph
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
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
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
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
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
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
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/2 |>
SLICE:  PARAGRAPH > TEXT {} > "ASD"`);

      // Make sure there is nothing to the right
      editor.resetHistory();
      editor.update(OPS.moveForward({ target: TargetInteractors.Focused }));
      expect(editor.history).toHaveLength(0);
    });

    it("will delete inline emoji directly", () => {
      const editor = new Editor({ document: doc(paragraph(inlineText("AB"), inlineEmoji("tree"), inlineText("CD"))) });
      editor.update(OPS.jump({ to: { path: "0/1", orientation: On } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  PARAGRAPH > TEXT {} > "AB"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "AB"
PARAGRAPH > TEXT {} > "CD"`);
    });

    it("will move to inline emoji with the proper options", () => {
      const editor = new Editor({
        document: doc(
          paragraph(
            inlineEmoji("a"),
            inlineEmoji("b"),
            inlineText("CD"),
            inlineEmoji("c"),
            inlineUrlLink("G.com", "G"),
            inlineEmoji("d")
          )
        ),
      });
      editor.update(OPS.jump({ to: { path: "0/2/1", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowMovementInBoundaryCases: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/3
SLICE:  PARAGRAPH > EMOJI c`);

      editor.update(OPS.jump({ to: { path: "0/0", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowMovementInBoundaryCases: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/1
SLICE:  PARAGRAPH > EMOJI b`);

      editor.update(OPS.jump({ to: { path: "0/4", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowMovementInBoundaryCases: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/5
SLICE:  PARAGRAPH > EMOJI d`);
    });

    it("will delete multiple emoji", () => {
      const editor = new Editor({
        document: doc(paragraph(inlineText("AB"), inlineEmoji("turtle"), inlineEmoji("tree"), inlineText("CD"))),
      });
      editor.update(OPS.jump({ to: { path: "0/1", orientation: On } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowMovementInBoundaryCases: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/1
SLICE:  PARAGRAPH > EMOJI tree`);
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowMovementInBoundaryCases: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  PARAGRAPH > TEXT {} > "AB"`);
    });

    it("will delete inline emoji indirectly when cursor is adjacent with proper options", () => {
      let editor = new Editor({ document: doc(paragraph(inlineText("AB"), inlineEmoji("first"))) });
      editor.update(OPS.jump({ to: { path: "0/0/1", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowAdjacentInlineEmojiDeletion: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  PARAGRAPH > TEXT {} > "AB"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "AB"`);

      editor = new Editor({ document: doc(paragraph(inlineEmoji("first"), inlineEmoji("second"))) });
      editor.update(OPS.jump({ to: { path: "0/0", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowAdjacentInlineEmojiDeletion: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0 |>
SLICE:  PARAGRAPH > EMOJI first`);

      editor = new Editor({ document: doc(paragraph(inlineUrlLink("G.com", "GOOGLE"), inlineEmoji("first"))) });
      editor.update(OPS.jump({ to: { path: "0/0", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward, allowAdjacentInlineEmojiDeletion: true }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0 |>
SLICE:  PARAGRAPH > URL_LINK G.com > "GOOGLE"`);
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > URL_LINK G.com > "GOOGLE"`);
    });

    it("will not delete inline emoji by default from in-between insertion points", () => {
      const editor = new Editor({
        document: doc(
          paragraph(inlineEmoji("turtle"), inlineEmoji("tree"), inlineUrlLink("G.com", "GOOGLE"), inlineEmoji("end"))
        ),
      });

      // The deletions in here should all be no-ops
      editor.update(OPS.jump({ to: { path: "0/0", orientation: Before } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0
SLICE:  PARAGRAPH > EMOJI turtle`);

      editor.update(OPS.jump({ to: { path: "0/2", orientation: After } }));
      editor.update(OPS.deleteAt({ direction: FlowDirection.Forward }));
      expect(debugState(editor)).toEqual(`
CURSOR: 0/2 |>
SLICE:  PARAGRAPH > URL_LINK G.com > "GOOGLE"`);

      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > EMOJI turtle
PARAGRAPH > EMOJI tree
PARAGRAPH > URL_LINK G.com > "GOOGLE"
PARAGRAPH > EMOJI end`);
    });

    //     xit("will join paragraphs", () => {});
    //     xit("will paragraph into header and header into paragraph", () => {});
  });
});
