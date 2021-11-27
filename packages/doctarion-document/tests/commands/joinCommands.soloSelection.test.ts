import { Commands, CursorOrientation, FlowDirection, JoinType } from "../../src";
import { docToXmlish, dumpAnchorsFromWorkingDocument } from "../utils";

import { CommandsTestUtils } from "./commands.testUtils";

const { Before, After } = CursorOrientation;

describe("join blocks with a selection interactor", () => {
  describe("backwards", () => {
    it("basically works", () => {
      const editor = CommandsTestUtils.getEditorForBasicDoc({ omitDefaultInteractor: true });
      editor.execute(
        Commands.addInteractor({
          at: { path: "1/0/4", orientation: Before },
          selectTo: { path: "3/0/0", orientation: Before },
          focused: true,
        })
      );

      editor.execute(Commands.join({ type: JoinType.Blocks, direction: FlowDirection.Backward }));

      expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
        "<h level=ONE> <s>Header1</s> </h>
        <p> <s styles=6:+B,8:-B>MMNNAABBCC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
      `);

      expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
        "Anchor: ∅ AFTER (Span:N)1/0⁙3 intr: ∅
        Anchor: ∅ AFTER (Span:B)1/0⁙7 intr: ∅"
      `);
    });

    it("will also convert block types", () => {
      const editor = CommandsTestUtils.getEditorForBasicDoc({ omitDefaultInteractor: true });
      editor.execute(
        Commands.addInteractor({
          at: { path: "0/0/4", orientation: Before },
          selectTo: { path: "3/0/0", orientation: Before },
          focused: true,
        })
      );

      editor.execute(
        Commands.join({ type: JoinType.Blocks, direction: FlowDirection.Backward, allowNodeTypeCoercion: true })
      );

      expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(
        `"<h level=ONE> <s styles=13:+B,15:-B>Header1MMNNAABBCC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </h>"`
      );
      expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
        "Anchor: ∅ AFTER (Span:d)0/0⁙3 intr: ∅
        Anchor: ∅ AFTER (Span:B)0/0⁙14 intr: ∅"
      `);
    });
  });

  describe("forwards", () => {
    it("basically works", () => {
      const editor = CommandsTestUtils.getEditorForBasicDoc({ omitDefaultInteractor: true });
      editor.execute(
        Commands.addInteractor({
          at: { path: "1/0/4", orientation: Before },
          selectTo: { path: "3/0/0", orientation: After },
          focused: true,
        })
      );
      editor.execute(Commands.join({ type: JoinType.Blocks, direction: FlowDirection.Forward }));

      expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
        "<h level=ONE> <s>Header1</s> </h>
        <p> <s styles=6:+B,8:-B>MMNNAABBCC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
      `);
      expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
        "Anchor: ∅ AFTER (Span:N)1/0⁙3 intr: ∅
        Anchor: ∅ AFTER (Span:C)1/0⁙8 intr: ∅"
      `);
    });

    it("will also convert block types", () => {
      const editor = CommandsTestUtils.getEditorForBasicDoc({ omitDefaultInteractor: true });
      editor.execute(
        Commands.addInteractor({
          at: { path: "0/0/4", orientation: Before },
          selectTo: { path: "3/0/0", orientation: Before },
          focused: true,
        })
      );

      editor.execute(
        Commands.join({ type: JoinType.Blocks, direction: FlowDirection.Forward, allowNodeTypeCoercion: true })
      );

      expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(
        `"<p> <s styles=13:+B,15:-B>Header1MMNNAABBCC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"`
      );
      expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
        "Anchor: ∅ AFTER (Span:d)0/0⁙3 intr: ∅
        Anchor: ∅ AFTER (Span:B)0/0⁙14 intr: ∅"
      `);
    });
  });
});
