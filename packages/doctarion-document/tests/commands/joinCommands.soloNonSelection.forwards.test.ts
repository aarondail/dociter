import { Commands, CursorOrientation, FlowDirection, JoinType } from "../../src";
import { docToXmlish, dumpAnchorsFromWorkingDocument } from "../test-utils";

import { CommandsTestUtils } from "./commands.testUtils";

const { On, After } = CursorOrientation;

describe("join blocks forwards (solo non selection)", () => {
  it("basically works", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "0/0/2", orientation: After } }));
    editor.execute(
      Commands.join({ direction: FlowDirection.Forward, allowNodeTypeCoercion: true, type: JoinType.Blocks })
    );

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<p> <s styles=13:+B>Header1MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:a)0/0⁙2 intr: ᯼ "`
    );
  });

  it("handles the last block of the document ok (no-op)", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/0/1", orientation: After } }));
    editor.execute(Commands.join({ direction: FlowDirection.Forward, type: JoinType.Blocks }));
    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)3/0⁙1 intr: ᯼ "`
    );
  });

  it("works with empty blocks", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "2", orientation: On } }));
    editor.execute(Commands.join({ direction: FlowDirection.Forward, type: JoinType.Blocks }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:C)2/0⁙0 intr: ᯼ "`
    );
  });
});
