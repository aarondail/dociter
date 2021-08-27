import { CursorOrientation } from "../../src/cursor";
import { HeaderLevel } from "../../src/document-model";
import { Editor, OPS } from "../../src/editor";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { After } = CursorOrientation;
const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugBlockSimple = DebugEditorHelpers.debugBlockSimple;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"), inlineText("DD"))
);

describe("delete selection", () => {
  it("basically works", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "0/0/0", orientation: After } }));
    editor.execute(OPS.jump({ to: { path: "3/1/2", orientation: After }, select: true }));
    editor.execute(OPS.delete({}));
    // Arguably this should be inside the URL_LINK
    expect(debugState(editor)).toMatchInlineSnapshot(`
      "
      CURSOR: <| 1/0
      SLICE:  PARAGRAPH > URL_LINK g.com > \\"GLE\\""
    `);
    expect(debugBlockSimple(editor.state.document, "1")).toMatchInlineSnapshot(`
      "
      PARAGRAPH > URL_LINK g.com > \\"GLE\\"
      PARAGRAPH > TEXT {} > \\"DD\\""
    `);
  });

  it("basically works backwards", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "3/1/2", orientation: After } }));
    editor.execute(OPS.jump({ to: { path: "0/0/0", orientation: After }, select: true }));
    editor.execute(OPS.delete({}));
    expect(debugState(editor)).toMatchInlineSnapshot(`
      "
      CURSOR: 0/0/0 |>
      SLICE:  HEADER ONE > TEXT {} > \\"H\\""
    `);
    expect(debugBlockSimple(editor.state.document, "1")).toMatchInlineSnapshot(`
      "
      PARAGRAPH > URL_LINK g.com > \\"GLE\\"
      PARAGRAPH > TEXT {} > \\"DD\\""
    `);
  });
});
