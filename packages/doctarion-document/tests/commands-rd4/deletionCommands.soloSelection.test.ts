import { Commands } from "../../src/commands-rd4";
import { CursorOrientation } from "../../src/traversal-rd4";
import { docToXmlish, dumpAnchorsFromWorkingDocument, nodeToXmlish } from "../utils-rd4";

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

  it("basically works (pulling forwards)", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "0/0/0", orientation: After } }));
    editor.execute(Commands.jump({ to: { path: "3/1/2", orientation: After }, select: true }));
    editor.execute(Commands.delete({}));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Hyperlink:G)1/0⁙0 intr: ᯼ "`
    );
    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>H</s> </h>
      <p> <hyperlink url=g.com>GLE</hyperlink> <s>DD</s> </p>"
    `);
  });

  it("basically works (pulling backwards)", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1/2", orientation: After } }));
    editor.execute(Commands.jump({ to: { path: "0/0/2", orientation: After }, select: true }));
    editor.execute(Commands.delete({}));
    // Arguably this should be inside the URL_LINK
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:a)0/0⁙2 intr: ᯼ "`
    );
    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Hea</s> </h>
      <p> <hyperlink url=g.com>GLE</hyperlink> <s>DD</s> </p>"
    `);
  });

  it("works when deleting the entire document", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "0/0/0", orientation: Before } }));
    editor.execute(Commands.jump({ to: { path: "3/2", orientation: After }, select: true }));
    editor.execute(Commands.delete({}));
    // Arguably this should be inside the URL_LINK
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN ON (Document) intr: ᯼ "`
    );
    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`""`);
  });

  it("works when deleting almost the entire document", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "0/0/0", orientation: After } }));
    editor.execute(Commands.jump({ to: { path: "3/2", orientation: After }, select: true }));
    editor.execute(Commands.delete({}));
    // Arguably this should be inside the URL_LINK
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:H)0/0⁙0 intr: ᯼ "`
    );
    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`"<h level=ONE> <s>H</s> </h>"`);
  });
});