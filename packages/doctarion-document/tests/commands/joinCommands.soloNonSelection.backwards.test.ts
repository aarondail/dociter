import { Commands, CursorOrientation, FlowDirection, JoinType } from "../../src";
import { docToXmlish, dumpAnchorsFromWorkingDocument } from "../test-utils";

import { CommandsTestUtils } from "./commands.testUtils";

const { On, After } = CursorOrientation;

describe("join blocks backwards (solo non selection)", () => {
  it("basically works", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0/2", orientation: After } }));
    editor.execute(
      Commands.joinInto({ direction: FlowDirection.Backward, allowNodeTypeCoercion: true, type: JoinType.Blocks })
    );

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s styles=13:+B>Header1MMNNAABB</s> </h>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:N)0/0⁙9 intr: ᯼ "`
    );
  });

  it("handles the first block of the document ok (no-op)", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "0/0/2", orientation: After } }));
    editor.execute(Commands.joinInto({ direction: FlowDirection.Backward, type: JoinType.Blocks }));
    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:a)0/0⁙2 intr: ᯼ "`
    );
  });

  it("works with empty blocks", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "2", orientation: On } }));
    editor.execute(Commands.joinInto({ direction: FlowDirection.Backward, type: JoinType.Blocks }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:B)1/0⁙7 intr: ᯼ "`
    );
  });
});
