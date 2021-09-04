/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { CursorOrientation } from "../../src/cursor";
import { HeaderLevel } from "../../src/document-model";
import { Editor, EditorOperationError, OPS, TargetInteractors } from "../../src/editor";
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
const debugCurrentBlock = DebugEditorHelpers.debugCurrentBlock;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MMM"), inlineText(""), inlineText("NNN")),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", ""), inlineText("DD")),
  paragraph(inlineUrlLink("e.com", "EE"), inlineUrlLink("f.com", "FF")),
  header(HeaderLevel.One)
);

describe("split should split", () => {
  //   fit("in the middle of an inline text", () => {
  //     const editor = new Editor({ document: testDoc1 });
  //     editor.execute(OPS.jump({ to: { path: "1/0/1", orientation: After } }));
  //     editor.execute(OPS.insert({ blocks: [paragraph()] }));
  //     expect(nodeToXml(editor.state.document.children[2]!)).toMatchInlineSnapshot(`
  //         "<PARAGRAPH>
  //         </PARAGRAPH>
  //         "
  //       `);
  //     // Should this be on the emoji? It is in other cases...?
  //     expect(debugState(editor)).toEqual(`
  // CURSOR: 2
  // SLICE:  PARAGRAPH`);
  //   });

  it("in the middle of a url link", () => {});

  it("before a url link", () => {});
  it("into a emoji", () => {});
  it("in a empty inline", () => {});
  it("in an empty paragraph", () => {});
  it("into a header", () => {});
  it("into an empty document", () => {});
});

// const testDoc1 = doc(
//   header(HeaderLevel.One, inlineText("H1")),
//   paragraph(inlineText("MMM"), inlineText(""), inlineText("NNN")),
//   paragraph(),
//   paragraph(inlineText("CC"), inlineUrlLink("g.com", ""), inlineText("DD")),
//   paragraph(inlineUrlLink("e.com", "EE"), inlineUrlLink("f.com", "FF")),
//   header(HeaderLevel.One)
// );

// describe("should insert header", () => {
//   it("in the middle of an inline text", () => {});
//   it("in the middle of a url link", () => {});
//   it("before a url link", () => {});
//   it("into a emoji", () => {});
//   it("in a empty inline", () => {});
//   it("in an empty paragraph", () => {});
//   it("into a header", () => {});
//   it("into an empty document", () => {});
// });
