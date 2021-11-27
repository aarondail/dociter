import { Commands, CursorOrientation, CursorPath, Editor, InteractorStatus, Path } from "../../src";
import { dumpAnchorsFromWorkingDocument } from "../utils";

import { CommandsTestUtils } from "./commands.testUtils";

const cursorBefore = (path: string) => new CursorPath(Path.parse(path), CursorOrientation.Before);
const cursorAfter = (path: string) => new CursorPath(Path.parse(path), CursorOrientation.After);

let editor: Editor;
beforeEach(() => {
  editor = CommandsTestUtils.getEditorForBasicDoc();
  editor.execute(Commands.updateInteractor({ id: editor.state.focusedInteractor!.id, name: "α" }));
});

describe("addInteractor", () => {
  it("can add non-focused interactors", () => {
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α "`
    );
    editor.execute(Commands.addInteractor({ at: cursorBefore("3/0/1"), name: "β" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN AFTER (Span:C)3/0⁙0 intr: β "
    `);
    editor.execute(Commands.addInteractor({ at: cursorAfter("1/0/0"), name: "γ" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN AFTER (Span:C)3/0⁙0 intr: β 
      Anchor: γ-MAIN AFTER (Span:M)1/0⁙0 intr: γ "
    `);
  });

  it("can add a focused interactors that takes focus", () => {
    editor.execute(Commands.addInteractor({ at: cursorBefore("3/0/1"), focused: true, name: "β" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN AFTER (Span:C)3/0⁙0 intr: β "
    `);
    expect(editor.state.focusedInteractor?.name).toEqual("β");
  });

  it("can add a inactive interactor", () => {
    const id = editor.execute(
      Commands.addInteractor({ at: cursorBefore("3/0/1"), status: InteractorStatus.Inactive, name: "β" })
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN AFTER (Span:C)3/0⁙0 intr: β "
    `);

    expect(editor.state.interactors.get(id!)?.status).toEqual(InteractorStatus.Inactive);
  });

  it("can add a selection interactors", () => {
    editor.execute(Commands.addInteractor({ at: cursorBefore("3/0/0"), selectTo: cursorAfter("3/0/1"), name: "β" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN BEFORE (Span:C)3/0⁙0 intr: β 
      Anchor: β-SELECTION AFTER (Span:C)3/0⁙1 intr: β "
    `);
  });

  it("wont add a duplicate interactor (non-selection)", () => {
    editor.execute(Commands.addInteractor({ at: cursorBefore("3/0/1"), name: "β" }));
    // This is the exact same cursor as before
    const newId = editor.execute(Commands.addInteractor({ at: cursorBefore("3/0/1"), name: "γ" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN AFTER (Span:C)3/0⁙0 intr: β "
    `);
    expect(newId).toBeUndefined();
  });

  it("will add a duplicate interactor if that status is different", () => {
    editor.execute(Commands.addInteractor({ at: cursorBefore("3/0/1"), name: "β" }));
    editor.execute(Commands.addInteractor({ at: cursorBefore("3/0/1"), status: InteractorStatus.Inactive, name: "γ" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN AFTER (Span:C)3/0⁙0 intr: β 
      Anchor: γ-MAIN AFTER (Span:C)3/0⁙0 intr: γ "
    `);
  });

  it("will have the main position slightly adjusted if there is a preferable position", () => {
    // An "after" position is preferable to a before position at this spot in text
    editor.execute(Commands.addInteractor({ at: cursorBefore("3/1/2"), name: "β" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN AFTER (Hyperlink:O)3/1⁙1 intr: β "
    `);
  });

  it("will have the selection anchor position slightly adjusted if there is a preferable position", () => {
    editor.execute(Commands.addInteractor({ at: cursorAfter("3/1/1"), selectTo: cursorBefore("3/1/3"), name: "β" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN AFTER (Hyperlink:O)3/1⁙1 intr: β 
      Anchor: β-SELECTION AFTER (Hyperlink:O)3/1⁙2 intr: β "
    `);
  });
});

describe("updateInteractor", () => {
  it("can update default interactor", () => {
    // This should be a no-op
    editor.execute(Commands.updateInteractor({ id: editor.state.focusedInteractor?.id || "" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α "`
    );

    editor.execute(
      Commands.updateInteractor({ id: editor.state.focusedInteractor?.id || "", to: cursorBefore("3/0/1") })
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: α-MAIN AFTER (Span:C)3/0⁙0 intr: α "`
    );
  });

  it("can change a non-selection to a selection", () => {
    const id = editor.execute(Commands.addInteractor({ at: cursorBefore("3/0/0"), name: "β" }))!;
    editor.execute(Commands.updateInteractor({ id, selectTo: cursorAfter("3/0/1") }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN BEFORE (Span:C)3/0⁙0 intr: β 
      Anchor: β-SELECTION AFTER (Span:C)3/0⁙1 intr: β "
    `);
  });

  it("can change a selection to a non-selection", () => {
    const id = editor.execute(
      Commands.addInteractor({ at: cursorBefore("3/0/0"), selectTo: cursorAfter("3/0/1"), name: "β" })
    )!;
    editor.execute(Commands.updateInteractor({ id, selectTo: undefined }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN BEFORE (Span:C)3/0⁙0 intr: β "
    `);
  });

  it("can change interactor status", () => {
    const id = editor.execute(Commands.addInteractor({ at: cursorBefore("1/0/0"), name: "β" }))!;
    editor.execute(Commands.updateInteractor({ id, status: InteractorStatus.Inactive }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN BEFORE (Span:M)1/0⁙0 intr: β "
    `);
    expect(editor.state.interactors.get(id)?.status).toEqual(InteractorStatus.Inactive);
    editor.execute(Commands.updateInteractor({ id, status: InteractorStatus.Active }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN BEFORE (Span:M)1/0⁙0 intr: β "
    `);
    expect(editor.state.interactors.get(id)?.status).toEqual(InteractorStatus.Active);
  });

  it("can move an interactor", () => {
    const id = editor.execute(Commands.addInteractor({ at: cursorBefore("1/0"), name: "β" }))!;
    editor.execute(Commands.updateInteractor({ id, to: cursorBefore("3/0/0") }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN BEFORE (Span:C)3/0⁙0 intr: β "
    `);
  });

  it("moving an interactor can result in deduplication", () => {
    editor.execute(Commands.addInteractor({ at: cursorBefore("1/0/0"), name: "β" }))!;
    const id = editor.execute(Commands.addInteractor({ at: cursorBefore("3/0/0"), name: "γ" }))!;
    editor.execute(Commands.updateInteractor({ id, to: cursorBefore("1/0/0") }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN BEFORE (Span:M)1/0⁙0 intr: β "
    `);
  });

  it("activating an interactor can result in deduplication", () => {
    editor.execute(Commands.addInteractor({ at: cursorBefore("1/0/0"), name: "β" }))!;
    const id = editor.execute(
      Commands.addInteractor({ at: cursorBefore("1/0/0"), status: InteractorStatus.Inactive, name: "γ" })
    )!;
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN BEFORE (Span:M)1/0⁙0 intr: β 
      Anchor: γ-MAIN BEFORE (Span:M)1/0⁙0 intr: γ "
    `);
    editor.execute(Commands.updateInteractor({ id, status: InteractorStatus.Active }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN BEFORE (Span:M)1/0⁙0 intr: β "
    `);
  });

  it("changing a selection to a non-selection can result in deduplication", () => {
    editor.execute(Commands.addInteractor({ at: cursorBefore("1/0/0"), name: "β" }))!;
    const id = editor.execute(
      Commands.addInteractor({ at: cursorBefore("1/0/0"), selectTo: cursorAfter("3/0/0"), name: "γ" })
    )!;
    editor.execute(Commands.updateInteractor({ id, selectTo: undefined }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN BEFORE (Span:M)1/0⁙0 intr: β "
    `);
  });

  it("will have the main position slightly adjusted if there is a preferable position", () => {
    // An "after" position is preferable to a before position at this spot in text
    editor.execute(Commands.updateInteractor({ id: editor.state.focusedInteractor!.id, to: cursorBefore("3/1/2") }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: α-MAIN AFTER (Hyperlink:O)3/1⁙1 intr: α "`
    );
  });

  it("will have the selection anchor position slightly adjusted if there is a preferable position", () => {
    // An "after" position is preferable to a before position at this spot in text
    editor.execute(
      Commands.updateInteractor({ id: editor.state.focusedInteractor!.id, selectTo: cursorBefore("3/1/2") })
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: α-SELECTION AFTER (Hyperlink:O)3/1⁙1 intr: α "
    `);
  });
});

describe("removeInteractor", () => {
  it("can remove all interactors", () => {
    const id0 = editor.state.focusedInteractor!.id;
    const id1 = editor.execute(Commands.addInteractor({ at: cursorBefore("1/0/0"), name: "β" }))!;
    const id2 = editor.execute(
      Commands.addInteractor({ at: cursorAfter("1/0/4"), selectTo: cursorAfter("3/0/0"), name: "γ" })
    )!;
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN BEFORE (Span:M)1/0⁙0 intr: β 
      Anchor: γ-MAIN AFTER (Span:A)1/0⁙4 intr: γ 
      Anchor: γ-SELECTION AFTER (Span:C)3/0⁙0 intr: γ "
    `);
    editor.execute(Commands.removeInteractor({ id: id2 }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α 
      Anchor: β-MAIN BEFORE (Span:M)1/0⁙0 intr: β "
    `);
    editor.execute(Commands.removeInteractor({ id: id1 }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: α-MAIN BEFORE (Span:H)0/0⁙0 intr: α "`
    );
    editor.execute(Commands.removeInteractor({ id: id0 }));
    expect(editor.state.focusedInteractor).toBeUndefined();
  });

  it("removing the focused interactor results in no focused interactor", () => {
    const id = editor.state.focusedInteractor!.id;
    editor.execute(Commands.removeInteractor({ id }));
    expect(editor.state.focusedInteractor).toBeUndefined();
  });
});
