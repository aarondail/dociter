import { CodeBlock, Commands, CursorOrientation, Header, HeaderLevel, NodeTemplate, Paragraph, Span } from "../../src";
import { docToXmlish, nodeToXmlish } from "../test-utils";

import { CommandsTestUtils } from "./commands.testUtils";

const { Before, After } = CursorOrientation;

describe("changeBlockType", () => {
  it("converts a header to a paragraph in the most simple case", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "0/0/2", orientation: Before } }));
    editor.execute(Commands.changeBlockType({ template: new NodeTemplate(Paragraph, {}) }));
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(`"<p> <s>Header1</s> </p>"`);
  });

  it("converts a paragraph to a header in the most simple case", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0/2", orientation: Before } }));
    editor.execute(Commands.changeBlockType({ template: new NodeTemplate(Header, { level: HeaderLevel.One }) }));
    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<h level=ONE> <s styles=6:+B>MMNNAABB</s> </h>"`
    );
  });

  it("should work on a selection across blocks", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "0/0/0", orientation: After } }));
    editor.execute(Commands.jump({ to: { path: "3/2/0", orientation: Before }, select: true }));
    editor.execute(Commands.changeBlockType({ template: new NodeTemplate(CodeBlock, { language: "js" }) }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<code language=js> <s>Header1</s> </code>
      <code language=js> <s styles=6:+B>MMNNAABB</s> </code>
      <code language=js> </code>
      <code language=js> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </code>"
    `);
  });
});
