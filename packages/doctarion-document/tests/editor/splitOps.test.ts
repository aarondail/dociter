/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { CursorOrientation } from "../../src/cursor";
import { HeaderLevel } from "../../src/document-model";
import { Editor, OPS } from "../../src/editor";
import {
  DebugEditorHelpers,
  doc,
  header,
  inlineEmoji,
  inlineText,
  inlineUrlLink,
  nodeToXml,
  paragraph,
} from "../utils";

const { Before, On, After } = CursorOrientation;
const debugState = DebugEditorHelpers.debugEditorStateSimple;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MMM"), inlineText(""), inlineText("NNN")),
  paragraph(),
  paragraph(inlineText("CC"), inlineEmoji("tree"), inlineText("DD")),
  paragraph(inlineUrlLink("e.com", "EE"), inlineUrlLink("f.com", "FF")),
  header(HeaderLevel.One)
);

describe("splitBlock should split", () => {
  it("in the middle of an inline text", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "1/0/1", orientation: After } }));
    editor.execute(OPS.splitBlock({}));
    expect(nodeToXml(editor.state.document.children[1]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>MM</TEXT>
      </PARAGRAPH>
      "
    `);
    expect(nodeToXml(editor.state.document.children[2]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>M</TEXT>
        <TEXT></TEXT>
        <TEXT>NNN</TEXT>
      </PARAGRAPH>
      "
    `);
    expect(debugState(editor)).toEqual(`
CURSOR: <| 2/0/0
SLICE:  PARAGRAPH > TEXT {} > "M"`);
  });

  it("at leading edge of a block", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "1/0/0", orientation: Before } }));
    editor.execute(OPS.splitBlock({}));
    expect(nodeToXml(editor.state.document.children[1]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
      </PARAGRAPH>
      "
    `);
    expect(nodeToXml(editor.state.document.children[2]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>MMM</TEXT>
        <TEXT></TEXT>
        <TEXT>NNN</TEXT>
      </PARAGRAPH>
      "
    `);
    // Should this be on the emoji? It is in other cases...?
    expect(debugState(editor)).toEqual(`
CURSOR: <| 2/0/0
SLICE:  PARAGRAPH > TEXT {} > "MMM"`);
  });

  it("at trailing edge of a block", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "1/2/2", orientation: After } }));
    editor.execute(OPS.splitBlock({}));
    expect(nodeToXml(editor.state.document.children[1]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>MMM</TEXT>
        <TEXT></TEXT>
        <TEXT>NNN</TEXT>
      </PARAGRAPH>
      "
    `);
    expect(nodeToXml(editor.state.document.children[2]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
      </PARAGRAPH>
      "
    `);
    expect(debugState(editor)).toEqual(`
CURSOR: 2
SLICE:  PARAGRAPH`);
  });

  it("in the middle of a url link", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "4/0/0", orientation: After } }));
    editor.execute(OPS.splitBlock({}));
    expect(nodeToXml(editor.state.document.children[4]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <URL_LINK e.com>E</URL_LINK>
      </PARAGRAPH>
      "
    `);
    expect(nodeToXml(editor.state.document.children[5]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <URL_LINK e.com>E</URL_LINK>
        <URL_LINK f.com>FF</URL_LINK>
      </PARAGRAPH>
      "
    `);
    // This should probably be before the E but maybe its fine
    expect(debugState(editor)).toEqual(`
CURSOR: <| 5/0
SLICE:  PARAGRAPH > URL_LINK e.com > "E"`);
  });

  it("between a url link", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "4/0", orientation: After } }));
    editor.execute(OPS.splitBlock({}));
    expect(nodeToXml(editor.state.document.children[4]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <URL_LINK e.com>EE</URL_LINK>
        <URL_LINK f.com>F</URL_LINK>
      </PARAGRAPH>
      "
    `);
    expect(nodeToXml(editor.state.document.children[5]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <URL_LINK f.com>F</URL_LINK>
      </PARAGRAPH>
      "
    `);
    // This should probably be before the E but maybe its fine
    expect(debugState(editor)).toEqual(`
CURSOR: <| 5/0
SLICE:  PARAGRAPH > URL_LINK f.com > "F"`);
  });

  it("a emoji", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "3/1", orientation: On } }));
    editor.execute(OPS.splitBlock({}));
    expect(nodeToXml(editor.state.document.children[3]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>CC</TEXT>
      </PARAGRAPH>
      "
    `);
    expect(nodeToXml(editor.state.document.children[4]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <EMOJI tree />
        <TEXT>DD</TEXT>
      </PARAGRAPH>
      "
    `);
    // This should probably be before the E but maybe its fine
    expect(debugState(editor)).toEqual(`
CURSOR: <| 4/0
SLICE:  PARAGRAPH > EMOJI tree`);
  });

  it("in a empty inline", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "1/1", orientation: On } }));
    editor.execute(OPS.splitBlock({}));
    expect(nodeToXml(editor.state.document.children[1]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>MMM</TEXT>
      </PARAGRAPH>
      "
    `);
    expect(nodeToXml(editor.state.document.children[2]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT></TEXT>
        <TEXT>NNN</TEXT>
      </PARAGRAPH>
      "
    `);
    expect(debugState(editor)).toEqual(`
CURSOR: 2/0
SLICE:  PARAGRAPH > TEXT {} > ""`);
  });

  it("in an empty paragraph", () => {
    const editor = new Editor({ document: doc(paragraph()) });
    editor.execute(OPS.jump({ to: { path: "0", orientation: On } }));
    editor.execute(OPS.splitBlock({}));
    expect(nodeToXml(editor.state.document.children[0]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
      </PARAGRAPH>
      "
    `);
    expect(nodeToXml(editor.state.document.children[1]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
      </PARAGRAPH>
      "
    `);
    expect(debugState(editor)).toEqual(`
CURSOR: 1
SLICE:  PARAGRAPH`);
  });

  it("into a header", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "0/0/0", orientation: After } }));
    editor.execute(OPS.splitBlock({}));
    expect(nodeToXml(editor.state.document.children[0]!)).toMatchInlineSnapshot(`
      "<HEADER>
        <TEXT>H</TEXT>
      </HEADER>
      "
    `);
    expect(nodeToXml(editor.state.document.children[1]!)).toMatchInlineSnapshot(`
      "<HEADER>
        <TEXT>1</TEXT>
      </HEADER>
      "
    `);
    expect(debugState(editor)).toEqual(`
CURSOR: <| 1/0/0
SLICE:  HEADER ONE > TEXT {} > "1"`);
  });

  it("into an empty document", () => {
    const editor = new Editor({ document: doc() });
    editor.execute(OPS.splitBlock({}));
    expect(nodeToXml(editor.state.document)).toMatchInlineSnapshot(`
      "<DOCUMENT>
      </DOCUMENT>
      "
    `);
  });
});
