import { Path } from "../../src/basic-traversal";
import { Cursor, CursorOrientation } from "../../src/cursor";
import { Editor, OPS } from "../../src/editor";
import { InteractorStatus } from "../../src/editor/interactor";
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
  let editor: Editor;
  beforeEach(() => {
    editor = new Editor({ document: testDoc1 });
  });

  it("can add non-focused interactors", () => {
    expect(debugInteractors(editor)).toEqual("(F) <| 0/0/0");
    editor.update(OPS.addInteractor({ mainCursor: cursorBefore("3/0/1") }));
    expect(debugInteractors(editor)).toEqual("(F) <| 0/0/0, <| 3/0/1");
    editor.update(OPS.addInteractor({ mainCursor: cursorAfter("1/0/0") }));
    expect(debugInteractors(editor)).toEqual("(F) <| 0/0/0, 1/0/0 |>, <| 3/0/1");
  });

  it("can add a focused interactors that takes focus", () => {
    editor.update(OPS.addInteractor({ mainCursor: cursorBefore("3/0/1"), focused: true }));
    expect(debugInteractors(editor)).toEqual("<| 0/0/0, (F) <| 3/0/1");
  });

  it("can add a inactive interactor", () => {
    editor.update(OPS.addInteractor({ mainCursor: cursorBefore("3/0/1"), status: InteractorStatus.Inactive }));
    expect(debugInteractors(editor)).toEqual("(F) <| 0/0/0, (I) <| 3/0/1");
  });

  it("can add a selection interactors", () => {
    editor.update(
      OPS.addInteractor({ mainCursor: cursorBefore("3/0/0"), selectionAnchorCursor: cursorAfter("3/0/1") })
    );
    expect(debugInteractors(editor)).toEqual("(F) <| 0/0/0, [<| 3/0/0 --> 3/0/1 |>]");
  });

  it("wont add a duplicate interactor (non-selection)", () => {
    editor.update(OPS.addInteractor({ mainCursor: cursorBefore("3/0/1") }));
    const newInteractorId = editor.interactors.filter((i) => !i.focused)[0].interactor.id;

    // This is the exact same cursor as before
    editor.update(OPS.addInteractor({ mainCursor: cursorBefore("3/0/1") }));
    expect(debugInteractors(editor)).toEqual("(F) <| 0/0/0, <| 3/0/1");

    // Ids should not be different (new interactor did not replace the existing one)
    const secondNewInteractorId = editor.interactors.filter((i) => !i.focused)[0].interactor.id;
    expect(newInteractorId).toEqual(secondNewInteractorId);
  });

  it("will add a duplicate interactor if that status is different", () => {
    editor.update(OPS.addInteractor({ mainCursor: cursorBefore("3/0/1") }));
    editor.update(OPS.addInteractor({ mainCursor: cursorBefore("3/0/1"), status: InteractorStatus.Inactive }));
    expect(debugInteractors(editor)).toEqual("(F) <| 0/0/0, <| 3/0/1, (I) <| 3/0/1");
  });
});
