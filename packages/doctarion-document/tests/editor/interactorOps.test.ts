/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Path } from "../../src/basic-traversal";
import { Cursor, CursorOrientation } from "../../src/cursor";
import { Editor, InteractorStatus, OPS } from "../../src/editor";
import { HeaderLevel } from "../../src/models";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { debugInteractorOrdering: debug } = DebugEditorHelpers;

const cursorBefore = (path: string) => new Cursor(Path.parse(path), CursorOrientation.Before);
const cursorAfter = (path: string) => new Cursor(Path.parse(path), CursorOrientation.After);

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN")),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"))
);

let editor: Editor;
beforeEach(() => {
  editor = new Editor({ document: testDoc1 });
});

describe("addInteractor", () => {
  it("can add non-focused interactors", () => {
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0");
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/1") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M 3/0/0 |>");
    editor.execute(OPS.addInteractor({ at: cursorAfter("1/0/0") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M 1/0/0 |>, 3.M 3/0/0 |>");
  });

  it("can add a focused interactors that takes focus", () => {
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/1"), focused: true }));
    expect(debug(editor)).toEqual("1.M <| 0/0/0, 2.M (F) 3/0/0 |>");
  });

  it("can add a inactive interactor", () => {
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/1"), status: InteractorStatus.Inactive }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M (I) 3/0/0 |>");
  });

  it("can add a selection interactors", () => {
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/0"), selectionAnchor: cursorAfter("3/0/1") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 3/0/0, 2.Sa 3/0/1 |>");
  });

  it("wont add a duplicate interactor (non-selection)", () => {
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/1") }));

    // This is the exact same cursor as before
    const newId = editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/1") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M 3/0/0 |>");
    expect(newId).toBeUndefined();
  });

  it("will add a duplicate interactor if that status is different", () => {
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/1") }));
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/1"), status: InteractorStatus.Inactive }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M 3/0/0 |>, 3.M (I) 3/0/0 |>");
  });

  it("will add interactors in the right order", () => {
    editor.execute(OPS.addInteractor({ at: cursorAfter("3/0/0") }));
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/0") }))!;
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 3/0/0, 3.M 3/0/0 |>");
  });

  it("will have the main position slightly adjusted if there is a preferable position", () => {
    // An "after" position is preferable to a before position at this spot in text
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/1/2") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M 3/1/1 |>");
  });

  it("will have the selection anchor position slightly adjusted if there is a preferable position", () => {
    // An "after" position is preferable to a before position at this spot in text
    editor.execute(OPS.addInteractor({ at: cursorAfter("3/1/1"), selectionAnchor: cursorBefore("3/1/3") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M 3/1/1 |>, 2.Sa 3/1/2 |>");
  });
});

describe("updateInteractor", () => {
  it("can update default interactor", () => {
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0");
    // This should be a no-op
    editor.execute(OPS.updateInteractor({ id: editor.focusedInteractor?.id || "" }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0");

    editor.execute(OPS.updateInteractor({ id: editor.focusedInteractor?.id || "", to: cursorBefore("3/0/1") }));
    expect(debug(editor)).toEqual("1.M (F) 3/0/0 |>");
  });

  it("can move an interactor changing the order appropriately", () => {
    editor.execute(OPS.addInteractor({ at: cursorAfter("3/0/0") }));
    const id = editor.execute(OPS.addInteractor({ at: cursorAfter("3/0/1") }))!;

    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M 3/0/0 |>, 3.M 3/0/1 |>");
    editor.execute(OPS.updateInteractor({ id, to: cursorBefore("3/0/0") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 3/0/0, 3.M 3/0/0 |>");
  });

  it("can change a non-selection to a selection", () => {
    const id = editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/0") }))!;
    editor.execute(OPS.updateInteractor({ id, selectionAnchor: cursorAfter("3/0/1") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 3/0/0, 2.Sa 3/0/1 |>");
  });

  it("can change a selection to a non-selection", () => {
    const id = editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/0"), selectionAnchor: cursorAfter("3/0/1") }))!;
    editor.execute(OPS.updateInteractor({ id, selectionAnchor: undefined }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 3/0/0");
  });

  it("can change interactor status", () => {
    const id = editor.execute(OPS.addInteractor({ at: cursorBefore("1/0/0") }))!;
    editor.execute(OPS.updateInteractor({ id, status: InteractorStatus.Inactive }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M (I) <| 1/0/0");
    editor.execute(OPS.updateInteractor({ id, status: InteractorStatus.Active }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 1/0/0");
  });

  it("can move an interactor", () => {
    const id = editor.execute(OPS.addInteractor({ at: cursorBefore("1/0") }))!;
    editor.execute(OPS.updateInteractor({ id, to: cursorBefore("3/0/0") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 3/0/0");
  });

  it("moving an interactor can result in deduplication", () => {
    editor.execute(OPS.addInteractor({ at: cursorBefore("1/0/0") }))!;
    const id = editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/0") }))!;
    editor.execute(OPS.updateInteractor({ id, to: cursorBefore("1/0/0") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 1/0/0");
  });

  it("activating an interactor can result in deduplication", () => {
    editor.execute(OPS.addInteractor({ at: cursorBefore("1/0/0") }))!;
    const id = editor.execute(OPS.addInteractor({ at: cursorBefore("1/0/0"), status: InteractorStatus.Inactive }))!;
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 1/0/0, 3.M (I) <| 1/0/0");
    editor.execute(OPS.updateInteractor({ id, status: InteractorStatus.Active }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 1/0/0");
  });

  it("changing a selection to a non-selection can result in deduplication", () => {
    editor.execute(OPS.addInteractor({ at: cursorBefore("1/0/0") }))!;
    const id = editor.execute(OPS.addInteractor({ at: cursorBefore("1/0/0"), selectionAnchor: cursorAfter("3/0/0") }))!;
    editor.execute(OPS.updateInteractor({ id, selectionAnchor: undefined }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 1/0/0");
  });

  it("will have the main position slightly adjusted if there is a preferable position", () => {
    // An "after" position is preferable to a before position at this spot in text
    editor.execute(OPS.updateInteractor({ id: editor.focusedInteractor!.id, to: cursorBefore("3/1/2") }));
    expect(debug(editor)).toEqual("1.M (F) 3/1/1 |>");
  });

  it("will have the selection anchor position slightly adjusted if there is a preferable position", () => {
    // An "after" position is preferable to a before position at this spot in text
    editor.execute(OPS.updateInteractor({ id: editor.focusedInteractor!.id, selectionAnchor: cursorBefore("3/1/2") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 1.Sa (F) 3/1/1 |>");
  });
});

describe("removeInteractor", () => {
  it("can remove all interactors", () => {
    const id0 = editor.focusedInteractor!.id;
    const id1 = editor.execute(OPS.addInteractor({ at: cursorBefore("1/0/0") }))!;
    const id2 = editor.execute(OPS.addInteractor({ at: cursorAfter("1/2/1"), selectionAnchor: cursorAfter("3/0/0") }))!;
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 1/0/0, 3.M 1/2/1 |>, 3.Sa 3/0/0 |>");
    editor.execute(OPS.removeInteractor({ id: id2 }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 1/0/0");
    editor.execute(OPS.removeInteractor({ id: id1 }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0");
    editor.execute(OPS.removeInteractor({ id: id0 }));
    expect(debug(editor)).toEqual("");
  });

  it("removing the focused interactor results in no focused interactor", () => {
    const id = editor.focusedInteractor!.id;
    editor.execute(OPS.removeInteractor({ id }));
    expect(debug(editor)).toEqual("");
    expect(editor.focusedInteractor).toBeUndefined();
  });
});
