import { Commands, CursorOrientation, FlowDirection } from "../../src";
import { docToXmlish, dumpAnchorsFromWorkingDocument, nodeToXmlish } from "../test-utils";

import { CommandsTestUtils } from "./commands.testUtils";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { After, Before, On } = CursorOrientation;

describe("deleting forwards (solo non selection)", () => {
  it("basically works", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    // Jump to the first O in the "GOOGLE" text of the url link
    // Note the cursor would be at: GO|OGLE
    editor.execute(Commands.jump({ to: { path: "3/1/1", orientation: After } }));
    editor.execute(Commands.delete({ direction: FlowDirection.Forward }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Link:O)3/1⁙1 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <lnk url=g.com>GOGLE</lnk> <s>DD</s> </p>"`
    );

    editor.execute(Commands.delete({ direction: FlowDirection.Forward }));
    editor.execute(Commands.delete({ direction: FlowDirection.Forward }));
    editor.execute(Commands.delete({ direction: FlowDirection.Forward }));

    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Link:O)3/1⁙1 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <lnk url=g.com>GO</lnk> <s>DD</s> </p>"`
    );

    // Note this is a no-op (because movement is disallowed by default)
    editor.execute(Commands.delete({ direction: FlowDirection.Forward }));

    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Link:O)3/1⁙1 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <lnk url=g.com>GO</lnk> <s>DD</s> </p>"`
    );

    // This will move teh cursor but not change the doc
    editor.execute(Commands.delete({ direction: FlowDirection.Forward, allowMovementInBoundaryCases: true }));

    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:D)3/2⁙0 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <lnk url=g.com>GO</lnk> <s>DD</s> </p>"`
    );
  });

  it("stops at the beginning of the doc", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/2/1", orientation: After } }));
    editor.execute(Commands.delete({ direction: FlowDirection.Forward }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:D)3/2⁙1 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"`
    );
  });

  it("will delete empty inline url link", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1/0", orientation: Before } }));
    editor.execute(Commands.jump({ to: { path: "3/1/4", orientation: After }, select: true }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: ᯼-MAIN AFTER (Link:L)3/1⁙4 intr: ᯼ 
      Anchor: ᯼-SELECTION BEFORE (Link:G)3/1⁙0 intr: ᯼ "
    `);
    editor.execute(Commands.delete({ direction: FlowDirection.Forward }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Link:E)3/1⁙0 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <lnk url=g.com>E</lnk> <s>DD</s> </p>"`
    );

    // Now delete the last character, should leave cursor ON the Link
    editor.execute(Commands.delete({ direction: FlowDirection.Forward }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN ON (Link)3/1 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <lnk url=g.com></lnk> <s>DD</s> </p>"`
    );

    // And this should delete the Link (and join the Spans)
    editor.execute(Commands.delete({ direction: FlowDirection.Forward }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)3/0⁙1 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(`"<p> <s>CCDD</s> </p>"`);
  });

  it("joins blocks when on edge, with appropriate options", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0/7", orientation: After } }));
    editor.execute(Commands.delete({ direction: FlowDirection.Forward, allowJoiningBlocksInBoundaryCases: true }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:B)1/0⁙7 intr: ᯼ "`
    );
    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);

    editor.execute(Commands.delete({ direction: FlowDirection.Forward, allowJoiningBlocksInBoundaryCases: true }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:B)1/0⁙7 intr: ᯼ "`
    );
    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B,8:-B>MMNNAABBCC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
  });
});
