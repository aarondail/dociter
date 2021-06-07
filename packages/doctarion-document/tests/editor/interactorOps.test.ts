/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Path } from "../../src/basic-traversal";
import { Cursor, CursorOrientation } from "../../src/cursor";
import { Editor, OPS } from "../../src/editor";
import { InteractorStatus } from "../../src/editor/interactor";
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
    editor.update(OPS.addInteractor({ at: cursorBefore("3/0/1") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 3/0/1");
    editor.update(OPS.addInteractor({ at: cursorAfter("1/0/0") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M 1/0/0 |>, 3.M <| 3/0/1");
  });

  it("can add a focused interactors that takes focus", () => {
    editor.update(OPS.addInteractor({ at: cursorBefore("3/0/1"), focused: true }));
    expect(debug(editor)).toEqual("1.M <| 0/0/0, 2.M (F) <| 3/0/1");
  });

  it("can add a inactive interactor", () => {
    editor.update(OPS.addInteractor({ at: cursorBefore("3/0/1"), status: InteractorStatus.Inactive }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M (I) <| 3/0/1");
  });

  it("can add a selection interactors", () => {
    editor.update(OPS.addInteractor({ at: cursorBefore("3/0/0"), selectionAnchor: cursorAfter("3/0/1") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 3/0/0, 2.Sa 3/0/1 |>");
  });

  it("wont add a duplicate interactor (non-selection)", () => {
    editor.update(OPS.addInteractor({ at: cursorBefore("3/0/1") }));

    // This is the exact same cursor as before
    const newId = editor.update(OPS.addInteractor({ at: cursorBefore("3/0/1") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 3/0/1");
    expect(newId).toBeUndefined();
  });

  it("will add a duplicate interactor if that status is different", () => {
    editor.update(OPS.addInteractor({ at: cursorBefore("3/0/1") }));
    editor.update(OPS.addInteractor({ at: cursorBefore("3/0/1"), status: InteractorStatus.Inactive }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 3/0/1, 3.M (I) <| 3/0/1");
  });

  it("will add interactors in the right order", () => {
    editor.update(OPS.addInteractor({ at: cursorAfter("3/0/0") }));
    editor.update(OPS.addInteractor({ at: cursorBefore("3/0/0") }))!;
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 3/0/0, 3.M 3/0/0 |>");
  });
});

describe("updateInteractor", () => {
  it("can update default interactor", () => {
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0");
    // This should be a no-op
    editor.update(OPS.updateInteractor({ id: editor.focusedInteractor?.id || "" }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0");

    editor.update(OPS.updateInteractor({ id: editor.focusedInteractor?.id || "", to: cursorBefore("3/0/1") }));
    expect(debug(editor)).toEqual("1.M (F) <| 3/0/1");
  });

  it("can move an interactor changing the order appropriately", () => {
    editor.update(OPS.addInteractor({ at: cursorAfter("3/0/0") }));
    const id = editor.update(OPS.addInteractor({ at: cursorAfter("3/0/1") }))!;

    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M 3/0/0 |>, 3.M 3/0/1 |>");
    editor.update(OPS.updateInteractor({ id, to: cursorBefore("3/0/0") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 3/0/0, 3.M 3/0/0 |>");
  });

  it("can change a non-selection to a selection", () => {
    const id = editor.update(OPS.addInteractor({ at: cursorBefore("3/0/0") }))!;
    editor.update(OPS.updateInteractor({ id, selectionAnchor: cursorAfter("3/0/1") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 3/0/0, 2.Sa 3/0/1 |>");
  });

  it("can change a selection to a non-selection", () => {
    const id = editor.update(OPS.addInteractor({ at: cursorBefore("3/0/0"), selectionAnchor: cursorAfter("3/0/1") }))!;
    editor.update(OPS.updateInteractor({ id, selectionAnchor: undefined }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 3/0/0");
  });

  it("can change interactor status", () => {
    const id = editor.update(OPS.addInteractor({ at: cursorBefore("1/0") }))!;
    editor.update(OPS.updateInteractor({ id, status: InteractorStatus.Inactive }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M (I) <| 1/0");
    editor.update(OPS.updateInteractor({ id, status: InteractorStatus.Active }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 1/0");
  });

  it("can move an interactor", () => {
    const id = editor.update(OPS.addInteractor({ at: cursorBefore("1/0") }))!;
    editor.update(OPS.updateInteractor({ id, to: cursorBefore("3/0/0") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 3/0/0");
  });

  it("moving an interactor can result in deduplication", () => {
    editor.update(OPS.addInteractor({ at: cursorBefore("1/0") }))!;
    const id = editor.update(OPS.addInteractor({ at: cursorBefore("3/0/0") }))!;
    editor.update(OPS.updateInteractor({ id, to: cursorBefore("1/0") }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 1/0");
  });

  it("activating an interactor can result in deduplication", () => {
    editor.update(OPS.addInteractor({ at: cursorBefore("1/0") }))!;
    const id = editor.update(OPS.addInteractor({ at: cursorBefore("1/0"), status: InteractorStatus.Inactive }))!;
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 1/0, 3.M (I) <| 1/0");
    editor.update(OPS.updateInteractor({ id, status: InteractorStatus.Active }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 1/0");
  });

  it("changing a selection to a non-selection can result in deduplication", () => {
    editor.update(OPS.addInteractor({ at: cursorBefore("1/0") }))!;
    const id = editor.update(OPS.addInteractor({ at: cursorBefore("1/0"), selectionAnchor: cursorAfter("3/0/0") }))!;
    editor.update(OPS.updateInteractor({ id, selectionAnchor: undefined }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 1/0");
  });
});

describe("removeInteractor", () => {
  it("can remove all interactors", () => {
    const id0 = editor.focusedInteractor!.id;
    const id1 = editor.update(OPS.addInteractor({ at: cursorBefore("1/0") }))!;
    const id2 = editor.update(OPS.addInteractor({ at: cursorBefore("2"), selectionAnchor: cursorAfter("3/0/0") }))!;
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 1/0, 3.M <| 2, 3.Sa 3/0/0 |>");
    editor.update(OPS.removeInteractor({ id: id2 }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0, 2.M <| 1/0");
    editor.update(OPS.removeInteractor({ id: id1 }));
    expect(debug(editor)).toEqual("1.M (F) <| 0/0/0");
    editor.update(OPS.removeInteractor({ id: id0 }));
    expect(debug(editor)).toEqual("");
  });

  it("removing the focused interactor results in no focused interactor", () => {
    const id = editor.focusedInteractor!.id;
    editor.update(OPS.removeInteractor({ id }));
    expect(debug(editor)).toEqual("");
    expect(editor.focusedInteractor).toBeUndefined();
  });
});
