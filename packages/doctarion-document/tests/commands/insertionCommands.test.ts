import {
  Commands,
  CursorOrientation,
  Editor,
  Header,
  HeaderLevel,
  InteractorTargets,
  Link,
  Node,
  Paragraph,
  Span,
  Text,
} from "../../src";
import { docToXmlish, dumpAnchorsFromWorkingDocument, nodeToXmlish, testDoc } from "../test-utils";

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

  it("into an empty Link successfully", () => {
    const editor = new Editor({ document: testDoc`<p> <lnk url=g.com></lnk> </p>` });
    editor.execute(Commands.jump({ to: { path: "0/0", orientation: On } }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`"Anchor: ∅ ON (Link)0/0 intr: ∅"`);
    editor.execute(Commands.insert({ text: "Q", target: InteractorTargets.Focused }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Link:Q)0/0⁙0 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(`"<p> <lnk url=g.com>Q</lnk> </p>"`);
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

  it("around Links successfully", () => {
    const document = testDoc`<p> <lnk url=a.com>AA</lnk> <lnk url=b.com>BB</lnk> </p>`;
    let editor = new Editor({ document });
    editor.execute(Commands.jump({ to: { path: "0/0", orientation: Before } }));
    editor.execute(Commands.insert({ text: "QST" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:T)0/0⁙2 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <s>QST</s> <lnk url=a.com>AA</lnk> <lnk url=b.com>BB</lnk> </p>"`
    );

    editor = new Editor({ document });
    editor.execute(Commands.jump({ to: { path: "0/0", orientation: After } }));
    editor.execute(Commands.insert({ text: "QST" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:T)0/1⁙2 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <lnk url=a.com>AA</lnk> <s>QST</s> <lnk url=b.com>BB</lnk> </p>"`
    );

    editor = new Editor({ document });
    editor.execute(Commands.jump({ to: { path: "0/1", orientation: Before } }));
    editor.execute(Commands.insert({ text: "QST" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:T)0/1⁙2 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <lnk url=a.com>AA</lnk> <s>QST</s> <lnk url=b.com>BB</lnk> </p>"`
    );

    editor = new Editor({ document });
    editor.execute(Commands.jump({ to: { path: "0/1", orientation: After } }));
    editor.execute(Commands.insert({ text: "QST" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:T)0/2⁙2 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <lnk url=a.com>AA</lnk> <lnk url=b.com>BB</lnk> <s>QST</s> </p>"`
    );
  });

  it("between Link and Paragraph successfully", () => {
    const document = testDoc`<p> <s>AA</s> <lnk url=a.com>BB</lnk> <s>CC</s> </p>`;
    let editor = new Editor({ document });
    editor.execute(Commands.jump({ to: { path: "0/0/1", orientation: After } }));
    editor.execute(Commands.insert({ text: "QST" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:T)0/0⁙4 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <s>AAQST</s> <lnk url=a.com>BB</lnk> <s>CC</s> </p>"`
    );

    editor = new Editor({ document });
    editor.execute(Commands.jump({ to: { path: "0/1", orientation: Before } }));
    editor.execute(Commands.insert({ text: "QST" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:T)0/0⁙4 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <s>AAQST</s> <lnk url=a.com>BB</lnk> <s>CC</s> </p>"`
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
      `"<p> <s>AA</s> <lnk url=a.com>BB</lnk> <s>QSTCC</s> </p>"`
    );

    editor = new Editor({ document });
    editor.execute(Commands.jump({ to: { path: "0/2/0", orientation: Before } }));
    editor.execute(Commands.insert({ text: "QST" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:T)0/2⁙2 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <s>AA</s> <lnk url=a.com>BB</lnk> <s>QSTCC</s> </p>"`
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

describe("insert should insert a Link", () => {
  it("into an empty paragraph", () => {
    const editor = new Editor({ document: testDoc`<p> </p>` });
    editor.execute(Commands.jump({ to: { path: "0", orientation: On } }));
    editor.execute(Commands.insert({ node: new Node(Link, Text.fromString("ABC"), { url: "test.com" }) }));

    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <lnk url=test.com>ABC</lnk> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`"Anchor: ∅ AFTER (Link)0/0 intr: ∅"`);
  });

  it("before an Link", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1", orientation: Before } }));
    editor.execute(Commands.insert({ node: new Node(Link, Text.fromString("ABC"), { url: "test.com" }) }));

    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <lnk url=test.com>ABC</lnk> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Link)3/1 intr: ᯼ "`
    );
  });

  it("between Links", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1", orientation: Before } }));
    editor.execute(Commands.insert({ node: new Node(Link, Text.fromString("ABC"), { url: "test.com" }) }));
    editor.execute(Commands.insert({ node: new Node(Link, Text.fromString("DEF"), { url: "other.com" }) }));

    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <lnk url=test.com>ABC</lnk> <lnk url=other.com>DEF</lnk> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Link)3/2 intr: ᯼ "`
    );
  });

  it("after Links", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1", orientation: After } }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:D)3/2⁙0 intr: ᯼ "`
    );
    editor.execute(Commands.insert({ node: new Node(Link, Text.fromString("ABC"), { url: "test.com" }) }));

    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <lnk url=test.com>ABC</lnk> <s>DD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:D)3/3⁙0 intr: ᯼ "`
    );
  });

  it("into the middle of a Span with before orientation", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0/3", orientation: Before } }));
    editor.execute(Commands.insert({ node: new Node(Link, Text.fromString("ABC"), { url: "test.com" }) }));

    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s>MMN</s> <lnk url=test.com>ABC</lnk> <s styles=3:+B>NAABB</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:N)1/2⁙0 intr: ᯼ "`
    );
  });

  it("into the middle of a Span with after orientation", () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0/3", orientation: After } }));
    editor.execute(Commands.insert({ node: new Node(Link, Text.fromString("ABC"), { url: "test.com" }) }));

    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s>MMNN</s> <lnk url=test.com>ABC</lnk> <s styles=2:+B>AABB</s> </p>"`
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
    editor.execute(Commands.insert({ node: new Node(Span, Text.fromString("ABC"), {}) }));

    expect(nodeToXmlish(editor.state.document.children[2])).toMatchInlineSnapshot(`"<p> <s>ABC</s> </p>"`);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)2/0⁙2 intr: ᯼ "`
    );
  });

  it(`in the middle, at the beginning or at the end, of a Span`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0", orientation: After } }));
    editor.execute(Commands.insert({ node: new Node(Span, Text.fromString("ABC"), {}) }));
    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s styles=6:+B,8:-B>MMNNAABBABC</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)1/0⁙10 intr: ᯼ "`
    );

    editor.execute(Commands.jump({ to: { path: "1/0/3", orientation: After } }));
    editor.execute(Commands.insert({ node: new Node(Span, Text.fromString("DEF"), {}) }));
    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s styles=9:+B,11:-B>MMNNDEFAABBABC</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:F)1/0⁙6 intr: ᯼ "`
    );

    editor.execute(Commands.jump({ to: { path: "1/0", orientation: Before } }));
    editor.execute(Commands.insert({ node: new Node(Span, Text.fromString("GHI"), {}) }));

    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s styles=12:+B,14:-B>GHIMMNNDEFAABBABC</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:I)1/0⁙2 intr: ᯼ "`
    );
  });

  it(`in the middle of a Link`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1/2", orientation: After } }));
    editor.execute(Commands.insert({ node: new Node(Span, Text.fromString("ABC"), {}) }));

    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <lnk url=g.com>GOO</lnk> <s>ABC</s> <lnk url=g.com>GLE</lnk> <s>DD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)3/2⁙2 intr: ᯼ "`
    );
  });

  it(`at the beginning and end of a Link`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1/5", orientation: After } }));
    editor.execute(Commands.insert({ node: new Node(Span, Text.fromString("ABC"), {}) }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)3/2⁙2 intr: ᯼ "`
    );

    editor.execute(Commands.jump({ to: { path: "3/1/0", orientation: Before } }));
    editor.execute(Commands.insert({ node: new Node(Span, Text.fromString("DEF"), {}) }));

    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CCDEF</s> <lnk url=g.com>GOOGLE</lnk> <s>ABCDD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:F)3/0⁙4 intr: ᯼ "`
    );
  });

  it(`right before and after a Link`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1", orientation: After } }));
    editor.execute(Commands.insert({ node: new Node(Span, Text.fromString("ABC"), {}) }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)3/2⁙2 intr: ᯼ "`
    );

    editor.execute(Commands.jump({ to: { path: "3/1", orientation: Before } }));
    editor.execute(Commands.insert({ node: new Node(Span, Text.fromString("DEF"), {}) }));

    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CCDEF</s> <lnk url=g.com>GOOGLE</lnk> <s>ABCDD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:F)3/0⁙4 intr: ᯼ "`
    );
  });

  it(`between Links`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/1", orientation: After } }));
    editor.execute(Commands.insert({ node: new Node(Link, Text.fromString("ABC"), { url: "test.com" }) }));
    editor.execute(Commands.jump({ to: { path: "3/1", orientation: After } }));
    editor.execute(Commands.insert({ node: new Node(Span, Text.fromString("DEF"), {}) }));

    expect(nodeToXmlish(editor.state.document.children[3])).toMatchInlineSnapshot(
      `"<p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DEF</s> <lnk url=test.com>ABC</lnk> <s>DD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:F)3/2⁙2 intr: ᯼ "`
    );
  });

  it(`into an empty Links`, () => {
    const editor = new Editor({ document: testDoc`<p> <s>AB</s> <lnk url=test.com></lnk> <s>CD</s> </p>` });
    editor.execute(Commands.jump({ to: { path: "0/2", orientation: On } }));
    editor.execute(Commands.insert({ node: new Node(Span, Text.fromString("XYZ"), {}) }));

    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <s>ABXYZ</s> <lnk url=test.com></lnk> <s>CD</s> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:Z)0/0⁙4 intr: ∅"`
    );
  });
});

describe("insert should insert a Header", () => {
  const testHeaderNode = new Node(
    Header,
    [new Node(Link, Text.fromString("ABC"), { url: "test.com" }), new Node(Span, Text.fromString("ABC"), {})],
    { level: HeaderLevel.One }
  );

  it(`in the middle of a Paragraph`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0/3", orientation: After } }));
    editor.execute(Commands.insert({ node: testHeaderNode }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s>MMNN</s> </p>
      <h level=ONE> <lnk url=test.com>ABC</lnk> <s>ABC</s> </h>
      <p> <s styles=2:+B>AABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:A)3/0⁙0 intr: ᯼ "`
    );
  });

  it(`on an empty Paragraph`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "2", orientation: On } }));
    editor.execute(Commands.insert({ node: testHeaderNode }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <h level=ONE> <lnk url=test.com>ABC</lnk> <s>ABC</s> </h>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN ON (Paragraph)3 intr: ᯼ "`
    );
  });

  it(`at the leading edge of a Block`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "0/0/0", orientation: Before } }));
    editor.execute(Commands.insert({ node: testHeaderNode }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <lnk url=test.com>ABC</lnk> <s>ABC</s> </h>
      <h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:H)1/0⁙0 intr: ᯼ "`
    );
  });

  it(`at the trailing edge of a Block`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/2/1", orientation: After } }));
    editor.execute(Commands.insert({ node: testHeaderNode }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>
      <h level=ONE> <lnk url=test.com>ABC</lnk> <s>ABC</s> </h>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:C)4/1⁙2 intr: ᯼ "`
    );
  });

  it(`on an empty inline in a Paragraph`, () => {
    const editor = new Editor({ document: testDoc`<p> <s>AB</s> <lnk url=test.com>CD</lnk> <s></s> </p>` });
    editor.execute(Commands.jump({ to: { path: "0/2", orientation: On } }));
    editor.execute(Commands.insert({ node: testHeaderNode }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<p> <s>AB</s> <lnk url=test.com>CD</lnk> <s></s> </p>
      <h level=ONE> <lnk url=test.com>ABC</lnk> <s>ABC</s> </h>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:C)1/1⁙2 intr: ∅"`
    );
  });

  it(`on an in-between insertion point in a Paragraph`, () => {
    const editor = new Editor({
      document: testDoc`<p> <s>AB</s> <lnk url=test.com>CD</lnk> <lnk url=test2.com>EF</lnk> </p>`,
    });
    editor.execute(Commands.jump({ to: { path: "0/1", orientation: After } }));
    editor.execute(Commands.insert({ node: testHeaderNode }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<p> <s>AB</s> <lnk url=test.com>CD</lnk> </p>
      <h level=ONE> <lnk url=test.com>ABC</lnk> <s>ABC</s> </h>
      <p> <lnk url=test2.com>EF</lnk> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`"Anchor: ∅ BEFORE (Link)2/0 intr: ∅"`);
  });

  it(`on an empty Document`, () => {
    const editor = new Editor({ document: testDoc`` });
    editor.execute(Commands.insert({ node: testHeaderNode }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(
      `"<h level=ONE> <lnk url=test.com>ABC</lnk> <s>ABC</s> </h>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:C)0/1⁙2 intr: ∅"`
    );
  });
});

describe("insert should insert a Paragraph", () => {
  const testHeaderNode = new Node(
    Paragraph,
    [new Node(Span, Text.fromString("XYZ"), {}), new Node(Link, Text.fromString("XYZ"), { url: "test.com" })],
    {}
  );

  it(`in the middle of a Paragraph`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "1/0/3", orientation: After } }));
    editor.execute(Commands.insert({ node: testHeaderNode }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s>MMNN</s> </p>
      <p> <s>XYZ</s> <lnk url=test.com>XYZ</lnk> </p>
      <p> <s styles=2:+B>AABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:A)3/0⁙0 intr: ᯼ "`
    );
  });

  it(`on an empty Paragraph`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "2", orientation: On } }));
    editor.execute(Commands.insert({ node: testHeaderNode }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> <s>XYZ</s> <lnk url=test.com>XYZ</lnk> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN ON (Paragraph)3 intr: ᯼ "`
    );
  });

  it(`at the leading edge of a Block`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "0/0/0", orientation: Before } }));
    editor.execute(Commands.insert({ node: testHeaderNode }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<p> <s>XYZ</s> <lnk url=test.com>XYZ</lnk> </p>
      <h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN BEFORE (Span:H)1/0⁙0 intr: ᯼ "`
    );
  });

  it(`at the trailing edge of a Block`, () => {
    const editor = CommandsTestUtils.getEditorForBasicDoc();
    editor.execute(Commands.jump({ to: { path: "3/2/1", orientation: After } }));
    editor.execute(Commands.insert({ node: testHeaderNode }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>
      <p> <s>XYZ</s> <lnk url=test.com>XYZ</lnk> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Link)4/1 intr: ᯼ "`
    );
  });

  it(`on an empty inline in a Paragraph`, () => {
    const editor = new Editor({ document: testDoc`<p> <s>AB</s> <lnk url=test.com>CD</lnk> <s></s> </p>` });
    editor.execute(Commands.jump({ to: { path: "0/2", orientation: On } }));
    editor.execute(Commands.insert({ node: testHeaderNode }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<p> <s>AB</s> <lnk url=test.com>CD</lnk> <s></s> </p>
      <p> <s>XYZ</s> <lnk url=test.com>XYZ</lnk> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`"Anchor: ∅ AFTER (Link)1/1 intr: ∅"`);
  });

  it(`on an in-between insertion point in a Paragraph`, () => {
    const editor = new Editor({
      document: testDoc`<p> <s>AB</s> <lnk url=test.com>CD</lnk> <lnk url=test2.com>EF</lnk> </p>`,
    });
    editor.execute(Commands.jump({ to: { path: "0/1", orientation: After } }));
    editor.execute(Commands.insert({ node: testHeaderNode }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
      "<p> <s>AB</s> <lnk url=test.com>CD</lnk> </p>
      <p> <s>XYZ</s> <lnk url=test.com>XYZ</lnk> </p>
      <p> <lnk url=test2.com>EF</lnk> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`"Anchor: ∅ BEFORE (Link)2/0 intr: ∅"`);
  });

  it(`on an empty Document`, () => {
    const editor = new Editor({ document: testDoc`` });
    editor.execute(Commands.insert({ node: testHeaderNode }));

    expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(
      `"<p> <s>XYZ</s> <lnk url=test.com>XYZ</lnk> </p>"`
    );
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`"Anchor: ∅ AFTER (Link)0/1 intr: ∅"`);
  });
});
