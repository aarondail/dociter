import { Commands, Direction } from "../../src/commands-rd4";
import { CursorOrientation } from "../../src/traversal-rd4";
import { docToXmlish, dumpAnchorsFromWorkingDocument, nodeToXmlish } from "../utils-rd4";

import { CommandsTestUtils } from "./commands.testUtils";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { After, Before, On } = CursorOrientation;

describe("forwards", () => {
  it("basically works", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    // Jump to the first O in the "GOOGLE" text of the url link
    // Note the cursor would be at: GO|OGLE
    editor.execute(Commands.jump({ to: { path: "3/1/1", orientation: After } }));
    editor.execute(Commands.delete({ direction: Direction.Forward }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Hyperlink:O)3/1⁙1 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <hyperlink url=g.com>GOGLE</hyperlink> <s>DD</s> </p>"`
    );

    editor.execute(Commands.delete({ direction: Direction.Forward }));
    editor.execute(Commands.delete({ direction: Direction.Forward }));
    editor.execute(Commands.delete({ direction: Direction.Forward }));

    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Hyperlink:O)3/1⁙1 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <hyperlink url=g.com>GO</hyperlink> <s>DD</s> </p>"`
    );

    // Note this is a no-op (because movement is disallowed by default)
    editor.execute(Commands.delete({ direction: Direction.Forward }));

    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Hyperlink:O)3/1⁙1 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <hyperlink url=g.com>GO</hyperlink> <s>DD</s> </p>"`
    );

    // This will move teh cursor but not change the doc
    editor.execute(Commands.delete({ direction: Direction.Forward, allowMovementInBoundaryCases: true }));

    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:D)3/2⁙0 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <hyperlink url=g.com>GO</hyperlink> <s>DD</s> </p>"`
    );
  });

  it("stops at the beginning of the doc", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/2/1", orientation: After } }));
    editor.execute(Commands.delete({ direction: Direction.Forward }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:D)3/2⁙1 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"`
    );
  });

  it("will delete empty inline url link", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1/0", orientation: Before } }));
    editor.execute(Commands.jump({ to: { path: "3/1/4", orientation: After }, select: true }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: ᯼-MAIN AFTER (Hyperlink:L)3/1⁙4 intr: ᯼ 
      Anchor: ᯼-SELECTION BEFORE (Hyperlink:G)3/1⁙0 intr: ᯼ "
    `);
    editor.execute(Commands.delete({ direction: Direction.Forward }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Hyperlink:E)3/1⁙0 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <hyperlink url=g.com>E</hyperlink> <s>DD</s> </p>"`
    );

    // Now delete the last character, should leave cursor ON the Hyperlink
    editor.execute(Commands.moveBack({}));
    editor.execute(Commands.delete({ direction: Direction.Forward }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN ON (Hyperlink)3/1 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <hyperlink url=g.com></hyperlink> <s>DD</s> </p>"`
    );

    // And this should delete the Hyperlink (and join the Spans)
    editor.execute(Commands.delete({ direction: Direction.Forward }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)3/0⁙1 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(`"<p> <s>CCDD</s> </p>"`);
  });

  it("joins blocks when on edge, with appropriate options", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0/7", orientation: After } }));
    editor.execute(Commands.delete({ direction: Direction.Forward, allowJoiningBlocksInBoundaryCases: true }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:B)1/0⁙7 intr: ᯼ "`
    );
    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
    `);

    editor.execute(Commands.delete({ direction: Direction.Forward, allowJoiningBlocksInBoundaryCases: true }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:B)1/0⁙7 intr: ᯼ "`
    );
    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B,8:-B>MMNNAABBCC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
    `);
  });
});
