import { Path } from "../../src/basic-traversal";
import { Cursor, CursorOrientation } from "../../src/cursor";
import { Editor, OPS } from "../../src/editor";
import { HeaderLevel } from "../../src/models";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { debugInteractors } = DebugEditorHelpers;

const cursorBefore = (path: string) => new Cursor(Path.parse(path), CursorOrientation.Before);
const cursorAfter = (path: string) => new Cursor(Path.parse(path), CursorOrientation.After);

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN")),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"))
);

describe("addInteractor", () => {
  it("can add non-focused interactors", () => {
    const editor = new Editor({ document: testDoc1 });
    expect(debugInteractors(editor)).toEqual("FOCUSED <| 0/0/0");
    editor.update(OPS.addInteractor({ mainCursor: cursorBefore("3/0/1") }));
    expect(debugInteractors(editor)).toEqual("FOCUSED <| 0/0/0, <| 3/0/1");
    editor.update(OPS.addInteractor({ mainCursor: cursorAfter("1/0/0") }));
    expect(debugInteractors(editor)).toEqual("FOCUSED <| 0/0/0, 1/0/0 |>, <| 3/0/1");
  });
  // it("can add a focused interactors that takes focus", () => {});
  // it("can add a selection interactors", () => {});
  // it("wont add a duplicate interactor (non-selection)", () => {});
  // it("will add a duplicate interactor if that status is different", () => {});
});
