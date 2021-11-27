import { Commands, CursorOrientation, Editor, Hyperlink, InteractorTargets, Node, Span, Text } from "../../src";
import { dumpAnchorsFromWorkingDocument, nodeToXmlish, testDoc } from "../utils";

import { CommandsTestUtils } from "./commands.testUtils";

const { Before, On, After } = CursorOrientation;

describe("insert should insert text", () => {
  it("into the beginning of a Span", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    // Note the cursor orientation is before the character
    editor.execute(Commands.jump({ to: { path: "0/0/0", orientation: Before } }));
    editor.execute(Commands.insert({ text: "Q", target: InteractorTargets.Focused }));
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<h level=ONE> <s>QHeader1</s> </h>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:Q)0/0⁙0 intr: ᯼ "`
    );

    editor.execute(Commands.insert({ text: "R", target: InteractorTargets.Focused }));
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<h level=ONE> <s>QRHeader1</s> </h>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:R)0/0⁙1 intr: ᯼ "`
    );
  });

  it("into the middle of Span", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    // MMNN|AABB
    editor.execute(Commands.jump({ to: { path: "1/0/4", orientation: Before } }));
    editor.execute(Commands.insert({ text: "Q", target: InteractorTargets.Focused }));

    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:Q)1/0⁙4 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s styles=7:+B>MMNNQAABB</s> </p>"`
    );

    editor.execute(Commands.insert({ text: "R", target: InteractorTargets.Focused }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:R)1/0⁙5 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s styles=8:+B>MMNNQRAABB</s> </p>"`
    );

    editor.execute(Commands.moveBack({ target: InteractorTargets.Focused }));
    editor.execute(Commands.moveBack({ target: InteractorTargets.Focused }));
    editor.execute(Commands.moveForward({ target: InteractorTargets.Focused }));

    editor.execute(Commands.insert({ text: "S", target: InteractorTargets.Focused }));

    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:S)1/0⁙5 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s styles=9:+B>MMNNQSRAABB</s> </p>"`
    );

    editor.execute(Commands.moveForward({ target: InteractorTargets.Focused }));
    editor.execute(Commands.moveForward({ target: InteractorTargets.Focused }));
    editor.execute(Commands.moveForward({ target: InteractorTargets.Focused }));
    editor.execute(Commands.moveForward({ target: InteractorTargets.Focused }));
    editor.execute(Commands.moveForward({ target: InteractorTargets.Focused }));

    editor.execute(Commands.insert({ text: "x", target: InteractorTargets.Focused }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:x)1/0⁙11 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s styles=9:+B>MMNNQSRAABBx</s> </p>"`
    );
  });

  it("into an empty Paragraph successfully", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "2", orientation: On } }));
    editor.execute(Commands.insert({ text: "Q", target: InteractorTargets.Focused }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:Q)2/0⁙0 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[2])).toMatchInlineSnapshot(`"<p> <s>Q</s> </p>"`);
  });

  it("into an empty Header successfully", () => {
    const editor = new Editor({ document: testDoc`<h level=ONE> </h>` });
    editor.execute(Commands.jump({ to: { path: "0", orientation: On } }));
    editor.execute(Commands.insert({ text: "Q", target: InteractorTargets.Focused }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:Q)0/0⁙0 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(`"<h level=ONE> <s>Q</s> </h>"`);
  });

  it("into an empty Span successfully", () => {
    const editor = new Editor({ document: testDoc`<p> <s></s> </p>` });
    editor.execute(Commands.jump({ to: { path: "0/0", orientation: On } }));
    editor.execute(Commands.insert({ text: "Q", target: InteractorTargets.Focused }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:Q)0/0⁙0 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(`"<p> <s>Q</s> </p>"`);
  });

  it("into an empty Hyperlink successfully", () => {
    const editor = new Editor({ document: testDoc`<p> <hyperlink url=g.com></hyperlink> </p>` });
    editor.execute(Commands.jump({ to: { path: "0/0", orientation: On } }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`"Anchor: ∅ ON (Hyperlink)0/0 intr: ∅"`);
    editor.execute(Commands.insert({ text: "Q", target: InteractorTargets.Focused }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Hyperlink:Q)0/0⁙0 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <hyperlink url=g.com>Q</hyperlink> </p>"`
    );
  });

  it("into an empty Document successfully", () => {
    const editor = new Editor({ document: testDoc`` });
    editor.execute(Commands.jump({ to: { path: "", orientation: On } }));
    editor.execute(Commands.insert({ text: "Q", target: InteractorTargets.Focused }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:Q)0/0⁙0 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(`"<p> <s>Q</s> </p>"`);
  });

  it("with multiple graphemes successfully", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    // Jump to second M in the "M" Span
    editor.execute(Commands.jump({ to: { path: "1/0/1", orientation: After } }));
    editor.execute(Commands.insert({ text: "QST", target: InteractorTargets.Focused }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:T)1/0⁙4 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s styles=9:+B>MMQSTNNAABB</s> </p>"`
    );
  });

  it("around Hyperlinks successfully", () => {
    const document = testDoc`<p> <hyperlink url=a.com>AA</hyperlink> <hyperlink url=b.com>BB</hyperlink> </p>`;
    let editor = new Editor({ document });
    editor.execute(Commands.jump({ to: { path: "0/0", orientation: Before } }));
    editor.execute(Commands.insert({ text: "QST" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:T)0/0⁙2 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <s>QST</s> <hyperlink url=a.com>AA</hyperlink> <hyperlink url=b.com>BB</hyperlink> </p>"`
    );

    editor = new Editor({ document });
    editor.execute(Commands.jump({ to: { path: "0/0", orientation: After } }));
    editor.execute(Commands.insert({ text: "QST" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:T)0/1⁙2 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <hyperlink url=a.com>AA</hyperlink> <s>QST</s> <hyperlink url=b.com>BB</hyperlink> </p>"`
    );

    editor = new Editor({ document });
    editor.execute(Commands.jump({ to: { path: "0/1", orientation: Before } }));
    editor.execute(Commands.insert({ text: "QST" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:T)0/1⁙2 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <hyperlink url=a.com>AA</hyperlink> <s>QST</s> <hyperlink url=b.com>BB</hyperlink> </p>"`
    );

    editor = new Editor({ document });
    editor.execute(Commands.jump({ to: { path: "0/1", orientation: After } }));
    editor.execute(Commands.insert({ text: "QST" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:T)0/2⁙2 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <hyperlink url=a.com>AA</hyperlink> <hyperlink url=b.com>BB</hyperlink> <s>QST</s> </p>"`
    );
  });

  it("between Hyperlink and Paragraph successfully", () => {
    const document = testDoc`<p> <s>AA</s> <hyperlink url=a.com>BB</hyperlink> <s>CC</s> </p>`;
    let editor = new Editor({ document });
    editor.execute(Commands.jump({ to: { path: "0/0/1", orientation: After } }));
    editor.execute(Commands.insert({ text: "QST" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:T)0/0⁙4 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <s>AAQST</s> <hyperlink url=a.com>BB</hyperlink> <s>CC</s> </p>"`
    );

    editor = new Editor({ document });
    editor.execute(Commands.jump({ to: { path: "0/1", orientation: Before } }));
    editor.execute(Commands.insert({ text: "QST" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:T)0/0⁙4 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <s>AAQST</s> <hyperlink url=a.com>BB</hyperlink> <s>CC</s> </p>"`
    );

    editor = new Editor({ document });
    editor.execute(Commands.jump({ to: { path: "0/1", orientation: After } }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ BEFORE (Span:C)0/2⁙0 intr: ∅"`
    );
    editor.execute(Commands.insert({ text: "QST" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:T)0/2⁙2 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <s>AA</s> <hyperlink url=a.com>BB</hyperlink> <s>QSTCC</s> </p>"`
    );

    editor = new Editor({ document });
    editor.execute(Commands.jump({ to: { path: "0/2/0", orientation: Before } }));
    editor.execute(Commands.insert({ text: "QST" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:T)0/2⁙2 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <s>AA</s> <hyperlink url=a.com>BB</hyperlink> <s>QSTCC</s> </p>"`
    );
  });

  it("around a Span without creating a new Span", () => {
    let editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0", orientation: Before } }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:M)1/0⁙0 intr: ᯼ "`
    );
    editor.execute(Commands.insert({ text: "QST", target: InteractorTargets.Focused }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:T)1/0⁙2 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s styles=9:+B>QSTMMNNAABB</s> </p>"`
    );

    editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0", orientation: After } }));
    editor.execute(Commands.insert({ text: "QST", target: InteractorTargets.Focused }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:T)1/0⁙10 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s styles=6:+B>MMNNAABBQST</s> </p>"`
    );
  });
});

describe("insert should insert a Hyperlink", () => {
  it("into an empty paragraph", () => {
    const editor = new Editor({ document: testDoc`<p> </p>` });
    editor.execute(Commands.jump({ to: { path: "0", orientation: On } }));
    editor.execute(Commands.insert({ inline: new Node(Hyperlink, Text.fromString("ABC"), { url: "test.com" }) }));

    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <hyperlink url=test.com>ABC</hyperlink> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Hyperlink)0/0 intr: ∅"`
    );
  });

  it("before an Hyperlink", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1", orientation: Before } }));
    editor.execute(Commands.insert({ inline: new Node(Hyperlink, Text.fromString("ABC"), { url: "test.com" }) }));

    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <hyperlink url=test.com>ABC</hyperlink> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Hyperlink)3/1 intr: ᯼ "`
    );
  });

  it("between Hyperlinks", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1", orientation: Before } }));
    editor.execute(Commands.insert({ inline: new Node(Hyperlink, Text.fromString("ABC"), { url: "test.com" }) }));
    editor.execute(Commands.insert({ inline: new Node(Hyperlink, Text.fromString("DEF"), { url: "other.com" }) }));

    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <hyperlink url=test.com>ABC</hyperlink> <hyperlink url=other.com>DEF</hyperlink> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Hyperlink)3/2 intr: ᯼ "`
    );
  });

  it("after Hyperlinks", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1", orientation: After } }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:D)3/2⁙0 intr: ᯼ "`
    );
    editor.execute(Commands.insert({ inline: new Node(Hyperlink, Text.fromString("ABC"), { url: "test.com" }) }));

    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <hyperlink url=test.com>ABC</hyperlink> <s>DD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:D)3/3⁙0 intr: ᯼ "`
    );
  });

  it("into the middle of a Span with before orientation", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0/3", orientation: Before } }));
    editor.execute(Commands.insert({ inline: new Node(Hyperlink, Text.fromString("ABC"), { url: "test.com" }) }));

    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s>MMN</s> <hyperlink url=test.com>ABC</hyperlink> <s styles=3:+B>NAABB</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:N)1/2⁙0 intr: ᯼ "`
    );
  });

  it("into the middle of a Span with after orientation", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0/3", orientation: After } }));
    editor.execute(Commands.insert({ inline: new Node(Hyperlink, Text.fromString("ABC"), { url: "test.com" }) }));

    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s>MMNN</s> <hyperlink url=test.com>ABC</hyperlink> <s styles=2:+B>AABB</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:A)1/2⁙0 intr: ᯼ "`
    );
  });
});

describe("insert should insert a Span", () => {
  it(`into an empty Paragraph`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "2", orientation: On } }));
    editor.execute(Commands.insert({ inline: new Node(Span, Text.fromString("ABC"), {}) }));

    expect(nodeToXmlish(editor.state.document.children[2])).toMatchInlineSnapshot(`"<p> <s>ABC</s> </p>"`);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)2/0⁙2 intr: ᯼ "`
    );
  });

  it(`in the middle, at the beginning or at the end, of a Span`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0", orientation: After } }));
    editor.execute(Commands.insert({ inline: new Node(Span, Text.fromString("ABC"), {}) }));
    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s styles=6:+B,8:-B>MMNNAABBABC</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)1/0⁙10 intr: ᯼ "`
    );

    editor.execute(Commands.jump({ to: { path: "1/0/3", orientation: After } }));
    editor.execute(Commands.insert({ inline: new Node(Span, Text.fromString("DEF"), {}) }));
    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s styles=9:+B,11:-B>MMNNDEFAABBABC</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:F)1/0⁙6 intr: ᯼ "`
    );

    editor.execute(Commands.jump({ to: { path: "1/0", orientation: Before } }));
    editor.execute(Commands.insert({ inline: new Node(Span, Text.fromString("GHI"), {}) }));

    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s styles=12:+B,14:-B>GHIMMNNDEFAABBABC</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:I)1/0⁙2 intr: ᯼ "`
    );
  });

  it(`in the middle of a Hyperlink`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1/2", orientation: After } }));
    editor.execute(Commands.insert({ inline: new Node(Span, Text.fromString("ABC"), {}) }));

    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <hyperlink url=g.com>GOO</hyperlink> <s>ABC</s> <hyperlink url=g.com>GLE</hyperlink> <s>DD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)3/2⁙2 intr: ᯼ "`
    );
  });

  it(`at the beginning and end of a Hyperlink`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1/5", orientation: After } }));
    editor.execute(Commands.insert({ inline: new Node(Span, Text.fromString("ABC"), {}) }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)3/2⁙2 intr: ᯼ "`
    );

    editor.execute(Commands.jump({ to: { path: "3/1/0", orientation: Before } }));
    editor.execute(Commands.insert({ inline: new Node(Span, Text.fromString("DEF"), {}) }));

    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CCDEF</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>ABCDD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:F)3/0⁙4 intr: ᯼ "`
    );
  });

  it(`right before and after a Hyperlink`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1", orientation: After } }));
    editor.execute(Commands.insert({ inline: new Node(Span, Text.fromString("ABC"), {}) }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)3/2⁙2 intr: ᯼ "`
    );

    editor.execute(Commands.jump({ to: { path: "3/1", orientation: Before } }));
    editor.execute(Commands.insert({ inline: new Node(Span, Text.fromString("DEF"), {}) }));

    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CCDEF</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>ABCDD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:F)3/0⁙4 intr: ᯼ "`
    );
  });

  it(`between Hyperlinks`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1", orientation: After } }));
    editor.execute(Commands.insert({ inline: new Node(Hyperlink, Text.fromString("ABC"), { url: "test.com" }) }));
    editor.execute(Commands.jump({ to: { path: "3/1", orientation: After } }));
    editor.execute(Commands.insert({ inline: new Node(Span, Text.fromString("DEF"), {}) }));

    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DEF</s> <hyperlink url=test.com>ABC</hyperlink> <s>DD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:F)3/2⁙2 intr: ᯼ "`
    );
  });

  it(`into an empty Hyperlinks`, () => {
    const editor = new Editor({ document: testDoc`<p> <s>AB</s> <hyperlink url=test.com></hyperlink> <s>CD</s> </p>` });
    editor.execute(Commands.jump({ to: { path: "0/2", orientation: On } }));
    editor.execute(Commands.insert({ inline: new Node(Span, Text.fromString("XYZ"), {}) }));

    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <s>ABXYZ</s> <hyperlink url=test.com></hyperlink> <s>CD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:Z)0/0⁙4 intr: ∅"`
    );
  });
});

// TODO once we support inserting blocks add the following tests:

// describe("insert should insert a Header", () => {
//   it.only(`in the middle of a Paragraph`, () => {
//     const editor = CommandsTestUtils.getEditorForBasicDoc();
//     editor.execute(Commands.jump({ to: { path: "1/0/3", orientation: After } }));
//     editor.execute(Commands.insert({ inline: new Node(Paragraph, [
//       new Node(Hyperlink, Text.fromString("ABC"), { url: "test.com" }),
//       new Node(Span, Text.fromString("ABC"), {})
//      ], {}) });

//     expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
//       `"<p> <s>MMNN</s> <hyperlink url=test.com>ABC</hyperlink> <s styles=2:+B>AABB</s> </p>"`
//     );
//     expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
//       `"Anchor: ᯼-MAIN BEFORE (Span:A)1/2⁙0 intr: ᯼ "`
//     );
//   });

// it(`on an empty Paragraph`, () => {
// })
// });

// describe("insert should insert a Paragraph", () => {
//   it.only(`in the middle of a Paragraph`, () => {
//   })
//   it.only(`on an empty Paragraph`, () => {
//   })
// });
