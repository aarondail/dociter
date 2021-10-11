import { Path } from "../../src/basic-traversal";
import { Cursor, CursorOrientation } from "../../src/cursor";
import { HeaderLevel } from "../../src/document-model";
import { Editor, OPS } from "../../src/editor";
import { InteractorStatus } from "../../src/working-document";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { debugInteractors: debug } = DebugEditorHelpers;

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
  editor.execute(OPS.updateInteractor({ id: editor.state.focusedInteractor!.id, name: "α" }));
});

describe("addInteractor", () => {
  it("can add non-focused interactors", () => {
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0`);
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/1"), name: "β" }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β 3/0/0 |>`);
    editor.execute(OPS.addInteractor({ at: cursorAfter("1/0/0"), name: "γ" }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β 3/0/0 |>, γ 1/0/0 |>`);
  });

  it("can add a focused interactors that takes focus", () => {
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/1"), focused: true, name: "β" }));
    expect(debug(editor)).toEqual(`α <| 0/0/0, β (F) 3/0/0 |>`);
  });

  it("can add a inactive interactor", () => {
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/1"), status: InteractorStatus.Inactive, name: "β" }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β (I) 3/0/0 |>`);
  });

  it("can add a selection interactors", () => {
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/0"), selectTo: cursorAfter("3/0/1"), name: "β" }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β <| 3/0/0 ◉◀◀◀ 3/0/1 |>`);
  });

  it("wont add a duplicate interactor (non-selection)", () => {
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/1"), name: "β" }));

    // This is the exact same cursor as before
    const newId = editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/1"), name: "γ" }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β 3/0/0 |>`);
    expect(newId).toBeUndefined();
  });

  it("will add a duplicate interactor if that status is different", () => {
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/1"), name: "β" }));
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/1"), status: InteractorStatus.Inactive, name: "γ" }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β 3/0/0 |>, γ (I) 3/0/0 |>`);
  });

  it("will have the main position slightly adjusted if there is a preferable position", () => {
    // An "after" position is preferable to a before position at this spot in text
    editor.execute(OPS.addInteractor({ at: cursorBefore("3/1/2"), name: "β" }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β 3/1/1 |>`);
  });

  it("will have the selection anchor position slightly adjusted if there is a preferable position", () => {
    // An "after" position is preferable to a before position at this spot in text
    editor.execute(OPS.addInteractor({ at: cursorAfter("3/1/1"), selectTo: cursorBefore("3/1/3"), name: "β" }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β 3/1/1 |> ◉◀◀◀ 3/1/2 |>`);
  });
});

describe("updateInteractor", () => {
  it("can update default interactor", () => {
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0`);
    // This should be a no-op
    editor.execute(OPS.updateInteractor({ id: editor.state.focusedInteractor?.id || "" }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0`);

    editor.execute(OPS.updateInteractor({ id: editor.state.focusedInteractor?.id || "", to: cursorBefore("3/0/1") }));
    expect(debug(editor)).toEqual(`α (F) 3/0/0 |>`);
  });

  it("can change a non-selection to a selection", () => {
    const id = editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/0"), name: "β" }))!;
    editor.execute(OPS.updateInteractor({ id, selectTo: cursorAfter("3/0/1") }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β <| 3/0/0 ◉◀◀◀ 3/0/1 |>`);
  });

  it("can change a selection to a non-selection", () => {
    const id = editor.execute(
      OPS.addInteractor({ at: cursorBefore("3/0/0"), selectTo: cursorAfter("3/0/1"), name: "β" })
    )!;
    editor.execute(OPS.updateInteractor({ id, selectTo: undefined }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β <| 3/0/0`);
  });

  it("can change interactor status", () => {
    const id = editor.execute(OPS.addInteractor({ at: cursorBefore("1/0/0"), name: "β" }))!;
    editor.execute(OPS.updateInteractor({ id, status: InteractorStatus.Inactive }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β (I) <| 1/0/0`);
    editor.execute(OPS.updateInteractor({ id, status: InteractorStatus.Active }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β <| 1/0/0`);
  });

  it("can move an interactor", () => {
    const id = editor.execute(OPS.addInteractor({ at: cursorBefore("1/0"), name: "β" }))!;
    editor.execute(OPS.updateInteractor({ id, to: cursorBefore("3/0/0") }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β <| 3/0/0`);
  });

  it("moving an interactor can result in deduplication", () => {
    editor.execute(OPS.addInteractor({ at: cursorBefore("1/0/0"), name: "β" }))!;
    const id = editor.execute(OPS.addInteractor({ at: cursorBefore("3/0/0"), name: "γ" }))!;
    editor.execute(OPS.updateInteractor({ id, to: cursorBefore("1/0/0") }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β <| 1/0/0`);
  });

  it("activating an interactor can result in deduplication", () => {
    editor.execute(OPS.addInteractor({ at: cursorBefore("1/0/0"), name: "β" }))!;
    const id = editor.execute(
      OPS.addInteractor({ at: cursorBefore("1/0/0"), status: InteractorStatus.Inactive, name: "γ" })
    )!;
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β <| 1/0/0, γ (I) <| 1/0/0`);
    editor.execute(OPS.updateInteractor({ id, status: InteractorStatus.Active }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β <| 1/0/0`);
  });

  it("changing a selection to a non-selection can result in deduplication", () => {
    editor.execute(OPS.addInteractor({ at: cursorBefore("1/0/0"), name: "β" }))!;
    const id = editor.execute(
      OPS.addInteractor({ at: cursorBefore("1/0/0"), selectTo: cursorAfter("3/0/0"), name: "γ" })
    )!;
    editor.execute(OPS.updateInteractor({ id, selectTo: undefined }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β <| 1/0/0`);
  });

  it("will have the main position slightly adjusted if there is a preferable position", () => {
    // An "after" position is preferable to a before position at this spot in text
    editor.execute(OPS.updateInteractor({ id: editor.state.focusedInteractor!.id, to: cursorBefore("3/1/2") }));
    expect(debug(editor)).toEqual(`α (F) 3/1/1 |>`);
  });

  it("will have the selection anchor position slightly adjusted if there is a preferable position", () => {
    // An "after" position is preferable to a before position at this spot in text
    editor.execute(OPS.updateInteractor({ id: editor.state.focusedInteractor!.id, selectTo: cursorBefore("3/1/2") }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0 ◉◀◀◀ 3/1/1 |>`);
  });
});

describe("removeInteractor", () => {
  it("can remove all interactors", () => {
    const id0 = editor.state.focusedInteractor!.id;
    const id1 = editor.execute(OPS.addInteractor({ at: cursorBefore("1/0/0"), name: "β" }))!;
    const id2 = editor.execute(
      OPS.addInteractor({ at: cursorAfter("1/2/1"), selectTo: cursorAfter("3/0/0"), name: "γ" })
    )!;
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β <| 1/0/0, γ 1/2/1 |> ◉◀◀◀ 3/0/0 |>`);
    editor.execute(OPS.removeInteractor({ id: id2 }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0, β <| 1/0/0`);
    editor.execute(OPS.removeInteractor({ id: id1 }));
    expect(debug(editor)).toEqual(`α (F) <| 0/0/0`);
    editor.execute(OPS.removeInteractor({ id: id0 }));
    expect(editor.state.focusedInteractor).toBeUndefined();
  });

  it("removing the focused interactor results in no focused interactor", () => {
    const id = editor.state.focusedInteractor!.id;
    editor.execute(OPS.removeInteractor({ id }));
    expect(editor.state.focusedInteractor).toBeUndefined();
  });
});
