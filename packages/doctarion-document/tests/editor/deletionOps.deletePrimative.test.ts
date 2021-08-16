import { CursorOrientation } from "../../src/cursor";
import { Editor, OPS } from "../../src/editor";
import { HeaderLevel } from "../../src/models";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { Before, On, After } = CursorOrientation;
const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugCurrentBlock = DebugEditorHelpers.debugCurrentBlock;
const debugInteractorOrdering = DebugEditorHelpers.debugInteractorOrdering;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"), inlineText("DD"))
);

describe("deletePrimitive", () => {
  it("basically works", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "0/0/0", orientation: Before } }));
    editor.execute(OPS.deletePrimitive({ path: "0/0/1" }));
    expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0/0
SLICE:  HEADER ONE > TEXT {} > "H"`);

    editor.execute(OPS.jump({ to: { path: "1/0/0", orientation: Before } }));
    editor.execute(OPS.deletePrimitive({ path: "1/1" }));
    editor.execute(OPS.deletePrimitive({ path: "1/1/0" }));
    editor.execute(OPS.deletePrimitive({ path: "1/3" }));
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MM"
PARAGRAPH > TEXT {} > "N"
PARAGRAPH > TEXT {} > "AA"`);

    editor.execute(OPS.deletePrimitive({ path: "2" }));
    editor.execute(OPS.deletePrimitive({ path: "2/1/3" }));
    editor.execute(OPS.jump({ to: { path: "2/1/0", orientation: Before } }));
    expect(debugState(editor)).toEqual(`
CURSOR: <| 2/1/0
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOLE"`);
  });

  it("updates any contained interactors in a reasonable way", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "0/0/0", orientation: After } }));
    editor.execute(OPS.deletePrimitive({ path: "0" }));
    expect(debugState(editor)).toEqual(`
CURSOR: <| 0/0/0
SLICE:  PARAGRAPH > TEXT {} > "MM"`);

    editor.execute(
      OPS.addInteractor({
        at: { path: "0/1", orientation: On },
        selectTo: { path: "2/0/0", orientation: Before },
      })
    );
    editor.execute(OPS.deletePrimitive({ path: "0" }));
    expect(debugInteractorOrdering(editor)).toEqual(`1.M (F) 0, 2.M 0, 2.Sa <| 1/0/0`);
  });

  it("deleting document works correctly", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "0/0/0", orientation: Before } }));
    editor.execute(OPS.deletePrimitive({ path: "" }));
    expect(debugState(editor)).toEqual(`
CURSOR: 
SLICE:  `);
  });
});
