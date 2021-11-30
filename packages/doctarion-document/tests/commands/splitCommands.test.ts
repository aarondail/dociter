import { Commands, CursorOrientation, Editor } from "../../src";
import { docToXmlish, dumpAnchorsFromWorkingDocument, testDoc } from "../test-utils";

import { CommandsTestUtils } from "./commands.testUtils";

const { Before, On, After } = CursorOrientation;

describe("split should split", () => {
  it("in the middle of an inline text", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0/1", orientation: After } }));
    editor.execute(Commands.split({}));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s>MM</s> </p>
      <p> <s styles=4:+B>NNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:N)2/0⁙0 intr: ᯼ "`
    );
  });

  it("at leading edge of a block", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0/0", orientation: Before } }));
    editor.execute(Commands.split({}));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> </p>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:M)2/0⁙0 intr: ᯼ "`
    );
  });

  it("at trailing edge of a block", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0/7", orientation: After } }));
    editor.execute(Commands.split({}));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> <s styles=0:+B></s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN ON (Span)2/0 intr: ᯼ "`
    );
  });

  it("in the middle of a url link", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1/0", orientation: After } }));
    editor.execute(Commands.split({}));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>G</lnk> </p>
      <p> <lnk url=g.com>OOGLE</lnk> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Link:O)4/0⁙0 intr: ᯼ "`
    );
  });

  it("between a url link", () => {
    const editor = new Editor({
      document: testDoc`<p> <s>ABC</s> <lnk url=A.com>DEF</lnk> <lnk url=B.com>GHI</lnk> <s>JKL</s> </p>`,
    });
    editor.execute(Commands.jump({ to: { path: "0/1", orientation: After } }));
    editor.execute(Commands.split({}));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<p> <s>ABC</s> <lnk url=A.com>DEF</lnk> </p>
      <p> <lnk url=B.com>GHI</lnk> <s>JKL</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`"Anchor: ∅ BEFORE (Link)1/0 intr: ∅"`);
  });

  it("in a empty inline", () => {
    const editor = new Editor({
      document: testDoc`<p> <s></s> </p>`,
    });
    editor.execute(Commands.jump({ to: { path: "0/0", orientation: On } }));
    editor.execute(Commands.split({}));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<p> </p>
      <p> <s></s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`"Anchor: ∅ ON (Span)1/0 intr: ∅"`);
  });

  it("in an empty paragraph", () => {
    const editor = new Editor({ document: testDoc`<p> </p>` });
    editor.execute(Commands.jump({ to: { path: "0", orientation: On } }));
    editor.execute(Commands.split({}));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<p> </p>
      <p> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`"Anchor: ∅ ON (Paragraph)1 intr: ∅"`);
  });

  it("into a header", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "0/0/0", orientation: After } }));
    editor.execute(Commands.split({}));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>H</s> </h>
      <h level=ONE> <s>eader1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:e)1/0⁙0 intr: ᯼ "`
    );
  });

  it("on an empty header", () => {
    const editor = new Editor({ document: testDoc`<h level=ONE> </h>` });
    editor.execute(Commands.jump({ to: { path: "0", orientation: On } }));
    editor.execute(Commands.split({}));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> </h>
      <h level=ONE> </h>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`"Anchor: ∅ ON (Header)1 intr: ∅"`);
  });

  it("on an empty span in a header", () => {
    const editor = new Editor({ document: testDoc`<h level=ONE> <s></s> </h>` });
    editor.execute(Commands.jump({ to: { path: "0/0", orientation: On } }));
    editor.execute(Commands.split({}));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> </h>
      <h level=ONE> <s></s> </h>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`"Anchor: ∅ ON (Span)1/0 intr: ∅"`);
  });

  it("into an empty document", () => {
    const editor = new Editor({ document: testDoc`` });
    editor.execute(Commands.split({}));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`""`);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`"Anchor: ∅ ON (Document) intr: ∅"`);
  });
});
