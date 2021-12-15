import { Commands, CursorOrientation, FlowDirection, InteractorTargets } from "../../src";
import { docToXmlish, dumpAnchorsFromWorkingDocument, nodeToXmlish } from "../test-utils";

import { CommandsTestUtils } from "./commands.testUtils";

const { After } = CursorOrientation;

describe("delete with multiple interactors", () => {
  it("three pretty unrelated targeted interactors are updated appropriately", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc({ omitDefaultInteractor: true });
    // After the first e in the header
    editor.execute(Commands.addInteractor({ at: { path: "0/0/1", orientation: After } }));
    // After the second N in the second paragraph
    editor.execute(Commands.addInteractor({ at: { path: "1/0/3", orientation: After } }));
    // After the G in the URL link
    editor.execute(Commands.addInteractor({ at: { path: "3/1/0", orientation: After } }));
    editor.execute(Commands.delete({ target: InteractorTargets.All, direction: FlowDirection.Backward }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Hader1</s> </h>
      <p> <s styles=5:+B>MMNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>OOGLE</lnk> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: ∅ AFTER (Span:H)0/0⁙0 intr: ∅
      Anchor: ∅ AFTER (Span:N)1/0⁙2 intr: ∅
      Anchor: ∅ BEFORE (Link:O)3/1⁙0 intr: ∅"
    `);

    editor.execute(Commands.delete({ target: InteractorTargets.All, direction: FlowDirection.Backward }));
    editor.execute(Commands.delete({ target: InteractorTargets.All, direction: FlowDirection.Backward }));
    editor.execute(Commands.delete({ target: InteractorTargets.All, direction: FlowDirection.Backward }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>ader1</s> </h>
      <p> <s styles=2:+B>AABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>OOGLE</lnk> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: ∅ BEFORE (Span:a)0/0⁙0 intr: ∅
      Anchor: ∅ BEFORE (Span:A)1/0⁙0 intr: ∅
      Anchor: ∅ BEFORE (Link:O)3/1⁙0 intr: ∅"
    `);
  });

  it("three targeted related interactors are all updated appropriately", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc({ omitDefaultInteractor: true });
    // GO|GGLE
    editor.execute(Commands.addInteractor({ at: { path: "3/1/1", orientation: After } }));
    // GOGG|LE
    editor.execute(Commands.addInteractor({ at: { path: "3/1/3", orientation: After } }));
    // GOGGLE|
    editor.execute(Commands.addInteractor({ at: { path: "3/1/5", orientation: After } }));

    editor.execute(Commands.delete({ target: InteractorTargets.All, direction: FlowDirection.Backward }));
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <lnk url=g.com>GOL</lnk> <s>DD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
      "Anchor: ∅ AFTER (Link:G)3/1⁙0 intr: ∅
      Anchor: ∅ AFTER (Link:O)3/1⁙1 intr: ∅
      Anchor: ∅ AFTER (Link:L)3/1⁙2 intr: ∅"
    `);

    editor.execute(Commands.delete({ target: InteractorTargets.All, direction: FlowDirection.Backward }));
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <lnk url=g.com></lnk> <s>DD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`"Anchor: ∅ ON (Link)3/1 intr: ∅"`);

    editor.execute(Commands.delete({ target: InteractorTargets.All, direction: FlowDirection.Backward }));
    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(`"<p> <s>CCDD</s> </p>"`);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:C)3/0⁙1 intr: ∅"`
    );
  });
});
