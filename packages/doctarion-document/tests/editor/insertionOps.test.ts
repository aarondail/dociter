/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { CursorOrientation } from "../../src/cursor";
import { HeaderLevel } from "../../src/document-model";
import { Editor, EditorOperationError, OPS, TargetInteractors } from "../../src/editor";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, nodeToXml, paragraph } from "../utils";

const { Before, On, After } = CursorOrientation;
const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugCurrentBlock = DebugEditorHelpers.debugCurrentBlock;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MMM"), inlineText(""), inlineText("NNN")),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", ""), inlineText("DD")),
  paragraph(inlineUrlLink("e.com", "EE"), inlineUrlLink("f.com", "FF")),
  header(HeaderLevel.One)
);

describe("insert", () => {
  describe("should insert text", () => {
    it("into the beginning of inline text", () => {
      const editor = new Editor({ document: testDoc1 });
      // Note the cursor orientation is before the character
      editor.execute(OPS.jump({ to: { path: "0/0/0", orientation: Before } }));
      editor.execute(
        OPS.insert({
          text: "Q",
          target: TargetInteractors.Focused,
          allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
        })
      );
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/0 |>
SLICE:  HEADER ONE > TEXT {} > "QH1"`);
    });

    it("into the middle of inline text", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "1/0/1", orientation: After } }));
      editor.execute(
        OPS.insert({
          text: "Q",
          target: TargetInteractors.Focused,
          allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
        })
      );
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/2 |>
SLICE:  PARAGRAPH > TEXT {} > "MMQM"`);

      editor.execute(
        OPS.insert({
          text: "R",
          target: TargetInteractors.Focused,
          allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
        })
      );
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/3 |>
SLICE:  PARAGRAPH > TEXT {} > "MMQRM"`);

      editor.execute(OPS.moveBack({ target: TargetInteractors.Focused }));
      editor.execute(OPS.moveBack({ target: TargetInteractors.Focused }));
      editor.execute(OPS.moveForward({ target: TargetInteractors.Focused }));
      // Cursor should now be at MMNQ|RM
      editor.execute(
        OPS.insert({
          text: "S",
          target: TargetInteractors.Focused,
          allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
        })
      );
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/3 |>
SLICE:  PARAGRAPH > TEXT {} > "MMQSRM"`);
    });

    it("into an empty paragraph successfully", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "2", orientation: On } }));
      editor.execute(
        OPS.insert({
          text: "Q",
          target: TargetInteractors.Focused,
          allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
        })
      );
      expect(debugState(editor)).toEqual(`
CURSOR: 2/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "Q"`);
    });

    it("into an empty header successfully", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "5", orientation: On } }));
      editor.execute(
        OPS.insert({
          text: "Q",
          target: TargetInteractors.Focused,
          allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
        })
      );
      expect(debugState(editor)).toEqual(`
CURSOR: 5/0/0 |>
SLICE:  HEADER ONE > TEXT {} > "Q"`);
    });

    it("into an empty inline text", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "1/1", orientation: On } }));
      editor.execute(
        OPS.insert({
          text: "Q",
          target: TargetInteractors.Focused,
          allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
        })
      );
      expect(debugState(editor)).toEqual(`
CURSOR: 1/1/0 |>
SLICE:  PARAGRAPH > TEXT {} > "Q"`);
    });

    it("into an empty inline url link successfully", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "3/1", orientation: On } }));
      editor.execute(
        OPS.insert({
          text: "Q",
          target: TargetInteractors.Focused,
          allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
        })
      );
      expect(debugState(editor)).toEqual(`
CURSOR: 3/1/0 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "Q"`);
    });

    it("into an empty document successfully", () => {
      const editor = new Editor({ document: doc(paragraph()) });
      editor.execute(
        OPS.insert({
          text: "Q",
          target: TargetInteractors.Focused,
          allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
        })
      );
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/0 |>
SLICE:  PARAGRAPH > TEXT {} > "Q"`);
    });

    it("with multiple graphemes successfully", () => {
      const editor = new Editor({ document: testDoc1 });
      // Jump to second N in the "NNN" inline text
      editor.execute(OPS.jump({ to: { path: "1/2/1", orientation: After } }));
      editor.execute(
        OPS.insert({
          text: "QST",
          target: TargetInteractors.Focused,
          allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
        })
      );
      expect(debugState(editor)).toEqual(`
CURSOR: 1/2/4 |>
SLICE:  PARAGRAPH > TEXT {} > "NNQSTN"`);
    });

    it("between inline url links successfully", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "4/0", orientation: After } }));
      editor.execute(
        OPS.insert({
          text: "QST",
          target: TargetInteractors.Focused,
          allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
        })
      );
      expect(nodeToXml(editor.state.document.children[4]!)).toMatchInlineSnapshot(`
              "<PARAGRAPH>
                <URL_LINK e.com>EE</URL_LINK>
                <TEXT>QST</TEXT>
                <URL_LINK f.com>FF</URL_LINK>
              </PARAGRAPH>
              "
          `);
      expect(debugState(editor)).toEqual(`
CURSOR: 4/1/2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
    });

    it("between inline url link and the beginning of a paragraph successfully", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "4/0", orientation: Before } }));
      editor.execute(
        OPS.insert({
          text: "QST",
          target: TargetInteractors.Focused,
          allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
        })
      );
      expect(debugState(editor)).toEqual(`
CURSOR: 4/0/2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
    });

    it("between inline url link and the end of a paragraph successfully successfully", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "4/1", orientation: After } }));
      editor.execute(
        OPS.insert({
          text: "QST",
          target: TargetInteractors.Focused,
          allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
        })
      );
      expect(debugState(editor)).toEqual(`
CURSOR: 4/2/2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
    });

    it("but does not insert new text between two inline texts", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "1/0", orientation: After } }));
      editor.execute(
        OPS.insert({
          text: "QST",
          target: TargetInteractors.Focused,
          allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
        })
      );
      expect(debugState(editor)).not.toEqual(`
CURSOR: 1/1/2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
    });

    it("but does not insert new text before an inline text", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "0/0", orientation: Before } }));
      editor.execute(
        OPS.insert({
          text: "QST",
          target: TargetInteractors.Focused,
          allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
        })
      );
      expect(debugState(editor)).not.toEqual(`
CURSOR: 0/0/2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
    });

    it("but does not insert new text after an inline text", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "0/0", orientation: After } }));
      editor.execute(
        OPS.insert({
          text: "QST",
          target: TargetInteractors.Focused,
          allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
        })
      );
      expect(debugState(editor)).not.toEqual(`
CURSOR: 0/1/2 |>
SLICE:  PARAGRAPH > TEXT {} > "QST"`);
    });
  });

  describe("should insert a URL link", () => {
    // ---------------------------------------------------------------------------
    // Insertion at the Paragraph Level
    // ---------------------------------------------------------------------------
    it("into an empty paragraph", () => {
      const editor = new Editor({ document: doc(paragraph()) });
      editor.execute(OPS.jump({ to: { path: "0", orientation: On } }));
      editor.execute(OPS.insert({ inlines: [inlineUrlLink("test.com", "ABC")] }));
      expect(nodeToXml(editor.state.document.children[0]!)).toMatchInlineSnapshot(`
              "<PARAGRAPH>
                <URL_LINK test.com>ABC</URL_LINK>
              </PARAGRAPH>
              "
          `);
      expect(debugState(editor)).toEqual(`
CURSOR: 0/0/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
    });

    // ---------------------------------------------------------------------------
    // Insertion at the Inline Level
    // ---------------------------------------------------------------------------

    it("before an inline url link", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "4/0", orientation: Before } }));
      editor.execute(OPS.insert({ inlines: [inlineUrlLink("test.com", "ABC")] }));

      expect(debugState(editor)).toEqual(`
CURSOR: 4/0/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);

      // Check that prior and later content elements are what we expect
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > URL_LINK e.com > "EE"
PARAGRAPH > URL_LINK f.com > "FF"`);
    });

    it("between inline url links", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "4/1", orientation: Before } }));
      editor.execute(OPS.insert({ inlines: [inlineUrlLink("test.com", "ABC")] }));

      expect(debugState(editor)).toEqual(`
CURSOR: 4/1/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);

      // Check that prior and later content elements are what we expect
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > URL_LINK e.com > "EE"
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > URL_LINK f.com > "FF"`);
    });

    it("after inline url links", () => {
      let editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "4/0", orientation: After } }));
      editor.execute(OPS.insert({ inlines: [inlineUrlLink("test.com", "ABC")] }));

      expect(debugState(editor)).toEqual(`
CURSOR: 4/1/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);

      // Check that prior and later content elements are what we expect
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > URL_LINK e.com > "EE"
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > URL_LINK f.com > "FF"`);

      editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "4/1", orientation: After } }));
      editor.execute(OPS.insert({ inlines: [inlineUrlLink("test.com", "ABC")] }));

      expect(debugState(editor)).toEqual(`
CURSOR: 4/2/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);

      // Check that prior and later content elements are what we expect
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > URL_LINK e.com > "EE"
PARAGRAPH > URL_LINK f.com > "FF"
PARAGRAPH > URL_LINK test.com > "ABC"`);
    });

    // ---------------------------------------------------------------------------
    // Insertion at the Grapheme Level
    // ---------------------------------------------------------------------------

    it("into the middle of a inline text with before orientation", () => {
      const editor = new Editor({ document: testDoc1 });
      // This is putting the cursor in the middle of the NNN inline text
      editor.execute(OPS.jump({ to: { path: "1/2/1", orientation: Before } }));
      editor.execute(OPS.insert({ inlines: [inlineUrlLink("test.com", "ABC")] }));
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MMM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "N"
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > TEXT {} > "NN"`);
      expect(debugState(editor)).toEqual(`
CURSOR: 1/3/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
    });

    it("into the middle of a inline text with after orientation", () => {
      const editor = new Editor({ document: testDoc1 });
      // This is putting the cursor in the middle of the NNN inline text
      editor.execute(OPS.jump({ to: { path: "1/2/1", orientation: After } }));
      editor.execute(OPS.insert({ inlines: [inlineUrlLink("test.com", "ABC")] }));
      expect(debugState(editor)).toEqual(`
CURSOR: 1/3/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
      // Check that prior and later content elements are what we expect
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MMM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "NN"
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > TEXT {} > "N"`);
    });

    it("at the beginning of an inline text", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "1/0/0", orientation: Before } }));
      editor.execute(OPS.insert({ inlines: [inlineUrlLink("test.com", "ABC")] }));
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > TEXT {} > "MMM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "NNN"`);
      expect(debugState(editor)).toEqual(`
CURSOR: 1/0/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
    });

    it("at the end of an inline text", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "1/2/2", orientation: After } }));
      editor.execute(OPS.insert({ inlines: [inlineUrlLink("test.com", "ABC")] }));
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MMM"
PARAGRAPH > TEXT {} > ""
PARAGRAPH > TEXT {} > "NNN"
PARAGRAPH > URL_LINK test.com > "ABC"`);
      expect(debugState(editor)).toEqual(`
CURSOR: 1/3/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
    });

    it("should insert between two inline texts", () => {
      const editor = new Editor({ document: doc(paragraph(inlineText("AA"), inlineText("BB"))) });
      editor.execute(OPS.jump({ to: { path: "0/0/1", orientation: After } }));
      editor.execute(OPS.insert({ inlines: [inlineUrlLink("test.com", "ABC")] }));
      expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > URL_LINK test.com > "ABC"
PARAGRAPH > TEXT {} > "BB"`);
      expect(debugState(editor)).toEqual(`
CURSOR: 0/1/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
    });

    it("around an inline inline text when the orientation is on link", () => {
      const editor = new Editor({ document: testDoc1 });
      editor.execute(OPS.jump({ to: { path: "1/1", orientation: On } }));
      editor.execute(OPS.insert({ inlines: [inlineUrlLink("test.com", "ABC")] }));

      expect(nodeToXml(editor.state.document.children[1]!)).toMatchInlineSnapshot(`
        "<PARAGRAPH>
          <TEXT>MMM</TEXT>
          <URL_LINK test.com>ABC</URL_LINK>
          <TEXT></TEXT>
          <TEXT>NNN</TEXT>
        </PARAGRAPH>
        "
      `);

      expect(debugState(editor)).toEqual(`
CURSOR: 1/1/2 |>
SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
    });
  });
});
