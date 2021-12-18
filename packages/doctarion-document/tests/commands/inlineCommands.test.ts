import { Commands, CursorOrientation, Link, NodeTemplate, Span, Tag, Text } from "../../src";
import { docToXmlish, nodeToXmlish } from "../test-utils";

import { CommandsTestUtils } from "./commands.testUtils";

const { Before, After } = CursorOrientation;

describe("reconstructInlines", () => {
  it("should convert part of a span into a tag", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "0/0/2", orientation: Before } }));
    editor.execute(Commands.moveForward({ select: true }));
    editor.execute(Commands.moveForward({ select: true }));
    editor.execute(Commands.reconstructInlines({ template: new NodeTemplate(Tag, {}) }));
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<h level=ONE> <s>He</s> <tag>ad</tag> <s>er1</s> </h>"`
    );
  });

  it("should convert link into span", () => {
    let editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1/0", orientation: Before } }));
    editor.execute(Commands.jump({ to: { path: "3/1", orientation: After }, select: true }));
    editor.execute(Commands.reconstructInlines({ template: new NodeTemplate(Span, {}) }));
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(`"<p> <s>CCGOOGLEDD</s> </p>"`);

    // Do this a couple other ways
    editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1/0", orientation: Before } }));
    editor.execute(Commands.jump({ to: { path: "3/1/5", orientation: After }, select: true }));
    editor.execute(Commands.reconstructInlines({ template: new NodeTemplate(Span, {}) }));
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(`"<p> <s>CCGOOGLEDD</s> </p>"`);

    editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1", orientation: After } }));
    editor.execute(Commands.jump({ to: { path: "3/1", orientation: Before }, select: true }));
    editor.execute(Commands.reconstructInlines({ template: new NodeTemplate(Span, {}) }));
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(`"<p> <s>CCGOOGLEDD</s> </p>"`);
  });

  it("should convert multiple inlines into link", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/0/1", orientation: Before } }));
    editor.execute(Commands.jump({ to: { path: "3/2/1", orientation: Before }, select: true }));
    editor.execute(
      Commands.reconstructInlines({ template: new NodeTemplate(Link, { url: Text.fromString("test.com") }) })
    );
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>C</s> <lnk url=test.com>CGOOGLED</lnk> <s>D</s> </p>"`
    );
  });

  it("should work on a selection across blocks", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "0/0/0", orientation: After } }));
    editor.execute(Commands.jump({ to: { path: "3/2/0", orientation: Before }, select: true }));
    editor.execute(Commands.reconstructInlines({ template: new NodeTemplate(Span, {}) }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>H</s> </h>
      <p> <s>eader1MMNNAABBCCGOOGLEDD</s> </p>"
    `);
  });
});
