import { Commands } from "../../src/commands-rd4";
import { CursorOrientation } from "../../src/traversal-rd4";
import { dumpAnchorsFromWorkingDocument, nodeToXmlish } from "../utils-rd4";

import { CommandsTestUtils } from "./commands.testUtils";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { After, Before, On } = CursorOrientation;

describe("deleting backwards (solo non selection cursor)", () => {
  it("will delete empty inline url link", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1/0", orientation: Before } }));
    editor.execute(Commands.jump({ to: { path: "3/1", orientation: After }, select: true }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: ᯼-MAIN AFTER (Hyperlink:E)3/1⁙5 intr: ᯼ 
      Anchor: ᯼-SELECTION BEFORE (Hyperlink:G)3/1⁙0 intr: ᯼ "
    `);
    editor.execute(Commands.delete({}));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)3/0⁙1 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(`"<p> <s>CCDD</s> </p>"`);
  });
});
