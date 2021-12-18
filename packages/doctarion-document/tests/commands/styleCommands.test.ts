import { Commands, CursorOrientation, Editor } from "../../src";
import { docToXmlish, nodeToXmlish, testDoc } from "../test-utils";

import { CommandsTestUtils } from "./commands.testUtils";

const { Before, After } = CursorOrientation;

describe("styleText", () => {
  it("is (currently at least) a no-op if the interactor is not a selection", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "0/0/0", orientation: Before } }));
    editor.execute(Commands.styleText({ style: { foregroundColor: "red" } }));
    editor.execute(Commands.moveForward({}));
    editor.execute(Commands.styleText({ style: { foregroundColor: "red" } }));
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<h level=ONE> <s>Header1</s> </h>"`
    );
  });

  it("should generally work", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "0/0/0", orientation: Before } }));
    editor.execute(Commands.moveForward({ select: true }));
    editor.execute(Commands.styleText({ style: { bold: true } }));
    editor.execute(Commands.moveForward({ select: true }));
    editor.execute(Commands.moveForward({ select: true }));
    editor.execute(Commands.styleText({ style: { italic: true } }));
    editor.execute(Commands.jump({ to: { path: "1/0/0", orientation: After } }));
    editor.execute(Commands.moveForward({ select: true }));
    editor.execute(Commands.moveForward({ select: true }));
    editor.execute(Commands.styleText({ style: { foregroundColor: "red" } }));
    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s styles=0:+B+I,1:-B,3:-I>Header1</s> </h>
      <p> <s styles=1:+FC=red,3:-FC,6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
  });

  it("should be a no-op on Inline nodes that can't be styled", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1/2", orientation: After } }));
    editor.execute(Commands.moveBack({ select: true }));
    editor.execute(Commands.moveBack({ select: true }));
    editor.execute(Commands.styleText({ style: { foregroundColor: "blue" } }));

    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"`
    );
  });

  it("should work on a non-Span", () => {
    const editor = new Editor({ document: testDoc`<p> <inlinenote>HERE</inlinenote> </p>` });
    editor.execute(Commands.jump({ to: { path: "0/0/0", orientation: After } }));
    editor.execute(Commands.moveBack({ select: true }));
    editor.execute(Commands.styleText({ style: { foregroundColor: "blue" } }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(
      `"<p> <inlinenote styles=0:+FC=blue,1:-FC>HERE</inlinenote> </p>"`
    );
  });

  it("should work on a selection across nodes", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "0/0/0", orientation: After } }));
    editor.execute(Commands.jump({ to: { path: "3/2/0", orientation: Before }, select: true }));
    editor.execute(Commands.styleText({ style: { italic: true } }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s styles=1:+I>Header1</s> </h>
      <p> <s styles=0:+I,6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s styles=0:+I>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
  });

  it("should be able to clear styles", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0/2", orientation: After } }));
    editor.execute(Commands.jump({ to: { path: "1/0", orientation: After }, select: true }));
    editor.execute(Commands.styleText({ style: { bold: null } }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
  });
});

describe("clearTextStyle", () => {
  it("should be able to clear styles", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0/2", orientation: After } }));
    editor.execute(Commands.jump({ to: { path: "1/0", orientation: After }, select: true }));
    editor.execute(Commands.clearTextStyle({}));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
  });
});
