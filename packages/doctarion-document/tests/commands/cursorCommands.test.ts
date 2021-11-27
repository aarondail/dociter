import { CommandError, Commands, CursorOrientation, InteractorTargets } from "../../src";
import { dumpAnchorsFromWorkingDocument } from "../test-utils";

import { CommandsTestUtils } from "./commands.testUtils";

describe("moveForward", () => {
  it("behaves correctly at the end of the doc", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();

    // Jump to L in the "GOOGLE" text of the Hyperlink
    editor.execute(Commands.jump({ to: { path: "3/1/4", orientation: CursorOrientation.Before } }));
    editor.execute(Commands.moveForward({}));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Hyperlink:L)3/1⁙4 intr: ᯼ "`
    );

    editor.execute(Commands.moveForward({}));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Hyperlink:E)3/1⁙5 intr: ᯼ "`
    );

    editor.execute(Commands.moveForward({}));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:D)3/2⁙0 intr: ᯼ "`
    );

    editor.execute(Commands.moveForward({}));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:D)3/2⁙0 intr: ᯼ "`
    );

    editor.execute(Commands.moveForward({}));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:D)3/2⁙1 intr: ᯼ "`
    );

    // This next moveForward should have no effect
    editor.execute(Commands.moveForward({}));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:D)3/2⁙1 intr: ᯼ "`
    );
  });

  it("handles multiple cursors", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();

    // Jump to "GOOGLE" text of the Hyperlink
    editor.execute(Commands.jump({ to: { path: "3/1/0", orientation: CursorOrientation.Before } }));
    editor.execute(Commands.addInteractor({ at: { path: "3/1/1", orientation: CursorOrientation.After }, name: "β" }));
    editor.execute(Commands.addInteractor({ at: { path: "3/1/2", orientation: CursorOrientation.After }, name: "γ" }));

    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: ᯼-MAIN BEFORE (Hyperlink:G)3/1⁙0 intr: ᯼ 
      Anchor: β-MAIN AFTER (Hyperlink:O)3/1⁙1 intr: β 
      Anchor: γ-MAIN AFTER (Hyperlink:O)3/1⁙2 intr: γ "
    `);
    editor.execute(Commands.moveForward({ target: InteractorTargets.All }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: ᯼-MAIN AFTER (Hyperlink:G)3/1⁙0 intr: ᯼ 
      Anchor: β-MAIN AFTER (Hyperlink:O)3/1⁙2 intr: β 
      Anchor: γ-MAIN AFTER (Hyperlink:G)3/1⁙3 intr: γ "
    `);
    editor.execute(Commands.moveForward({ target: InteractorTargets.AllActive }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: ᯼-MAIN AFTER (Hyperlink:O)3/1⁙1 intr: ᯼ 
      Anchor: β-MAIN AFTER (Hyperlink:G)3/1⁙3 intr: β 
      Anchor: γ-MAIN AFTER (Hyperlink:L)3/1⁙4 intr: γ "
    `);
    // Should dedupe
    editor.execute(Commands.moveForward({ target: InteractorTargets.Focused }));
    editor.execute(Commands.moveForward({ target: InteractorTargets.Focused }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: ᯼-MAIN AFTER (Hyperlink:G)3/1⁙3 intr: ᯼ 
      Anchor: γ-MAIN AFTER (Hyperlink:L)3/1⁙4 intr: γ "
    `);
    // Should dedupe again
    editor.execute(Commands.moveForward({ target: InteractorTargets.Focused }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Hyperlink:L)3/1⁙4 intr: ᯼ "`
    );
  });
});

describe("moveBack", () => {
  it("behaves correctly at the end of the doc", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();

    // Jump to the first O in the "GOOGLE" text of the Hyperlink
    editor.execute(Commands.jump({ to: { path: "3/1/2", orientation: CursorOrientation.Before } }));
    editor.execute(Commands.moveBack({}));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Hyperlink:G)3/1⁙0 intr: ᯼ "`
    );

    editor.execute(Commands.moveBack({}));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Hyperlink:G)3/1⁙0 intr: ᯼ "`
    );

    editor.execute(Commands.moveBack({}));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)3/0⁙1 intr: ᯼ "`
    );

    editor.execute(Commands.moveBack({}));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)3/0⁙0 intr: ᯼ "`
    );

    editor.execute(Commands.moveBack({}));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:C)3/0⁙0 intr: ᯼ "`
    );
  });
});

describe("jump", () => {
  it("errors on jumping to invalid paths", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    expect(() =>
      editor.execute(Commands.jump({ to: { path: "4", orientation: CursorOrientation.Before } }))
    ).toThrowError(CommandError);
    expect(() =>
      editor.execute(Commands.jump({ to: { path: "1/2/99", orientation: CursorOrientation.Before } }))
    ).toThrowError(CommandError);
  });

  it("jumping to non-graphemes non insertion-points is handled gracefully", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "0", orientation: CursorOrientation.Before } }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:H)0/0⁙0 intr: ᯼ "`
    );
    editor.execute(Commands.jump({ to: { path: "", orientation: CursorOrientation.After } }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:D)3/2⁙1 intr: ᯼ "`
    );
    editor.execute(Commands.jump({ to: { path: "2", orientation: CursorOrientation.Before } }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:B)1/0⁙7 intr: ᯼ "`
    );
    editor.execute(Commands.jump({ to: { path: "2", orientation: CursorOrientation.On } }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN ON (Paragraph)2 intr: ᯼ "`
    );
  });

  it("may dedupe multiple cursors", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.addInteractor({ at: { path: "3/1/1", orientation: CursorOrientation.After } }));
    editor.execute(Commands.jump({ to: { path: "3/1/1", orientation: CursorOrientation.After } }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Hyperlink:O)3/1⁙1 intr: ᯼ "`
    );
  });
});
