import { Commands, InteractorTargets } from "../../src/commands-rd4";
import { Editor } from "../../src/editor-rd4";
import { CursorOrientation } from "../../src/traversal-rd4";
import { dumpAnchorsFromWorkingDocument, nodeToXmlish, testDoc } from "../utils-rd4";

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
    // Jump to second M in the "M" inline text
    editor.execute(Commands.jump({ to: { path: "1/0/1", orientation: After } }));
    editor.execute(Commands.insert({ text: "QST", target: InteractorTargets.Focused }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ᯼-MAIN AFTER (Span:T)1/0⁙4 intr: ᯼ "`
    );
    expect(nodeToXmlish(editor.state.document.children[1])).toMatchInlineSnapshot(
      `"<p> <s styles=9:+B>MMQSTNNAABB</s> </p>"`
    );
  });

  it("around inline url links successfully", () => {
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
      `"Anchor: ∅ AFTER (Span:Q)0/2⁙0 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <s>AA</s> <hyperlink url=a.com>BB</hyperlink> <s>QSTCC</s> </p>"`
    );

    editor = new Editor({ document });
    editor.execute(Commands.jump({ to: { path: "0/2/0", orientation: Before } }));
    editor.execute(Commands.insert({ text: "QST" }));
    expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(
      `"Anchor: ∅ AFTER (Span:Q)0/2⁙0 intr: ∅"`
    );
    expect(nodeToXmlish(editor.state.document.children[0])).toMatchInlineSnapshot(
      `"<p> <s>AA</s> <hyperlink url=a.com>BB</hyperlink> <s>QSTCC</s> </p>"`
    );
  });

  //   it("between inline url link and the end of a paragraph successfully successfully", () => {
  //     const editor = CommandsTestUtils.getEditorForBasicDoc();
  //     editor.execute(Commands.jump({ to: { path: "4/1", orientation: After } }));
  //     editor.execute(
  //       Commands.insert({
  //         text: "QST",
  //         target: InteractorTargets.Focused,
  //         allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
  //       })
  //     );
  //     expect(debugState(editor)).toEqual(`
  // CURSOR: 4/2/2 |>
  // SLICE:  PARAGRAPH > TEXT {} > "QST"`);
  //   });

  //   it("but does not insert new text between two inline texts", () => {
  //     const editor = CommandsTestUtils.getEditorForBasicDoc();
  //     editor.execute(Commands.jump({ to: { path: "1/0", orientation: After } }));
  //     editor.execute(
  //       Commands.insert({
  //         text: "QST",
  //         target: InteractorTargets.Focused,
  //         allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
  //       })
  //     );
  //     expect(debugState(editor)).not.toEqual(`
  // CURSOR: 1/1/2 |>
  // SLICE:  PARAGRAPH > TEXT {} > "QST"`);
  //   });

  //   it("but does not insert new text before an inline text", () => {
  //     const editor = CommandsTestUtils.getEditorForBasicDoc();
  //     editor.execute(Commands.jump({ to: { path: "0/0", orientation: Before } }));
  //     editor.execute(
  //       Commands.insert({
  //         text: "QST",
  //         target: InteractorTargets.Focused,
  //         allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
  //       })
  //     );
  //     expect(debugState(editor)).not.toEqual(`
  // CURSOR: 0/0/2 |>
  // SLICE:  PARAGRAPH > TEXT {} > "QST"`);
  //   });

  //   it("but does not insert new text after an inline text", () => {
  //     const editor = CommandsTestUtils.getEditorForBasicDoc();
  //     editor.execute(Commands.jump({ to: { path: "0/0", orientation: After } }));
  //     editor.execute(
  //       Commands.insert({
  //         text: "QST",
  //         target: InteractorTargets.Focused,
  //         allowCreationOfNewInlineTextAndParagrahsIfNeeded: true,
  //       })
  //     );
  //     expect(debugState(editor)).not.toEqual(`
  // CURSOR: 0/1/2 |>
  // SLICE:  PARAGRAPH > TEXT {} > "QST"`);
  //   });
});

// describe("insert should insert a Hyperlink", () => {
//   // ---------------------------------------------------------------------------
//   // Insertion at the Paragraph Level
//   // ---------------------------------------------------------------------------
//   it("into an empty paragraph", () => {
//     const editor = new Editor({ document: doc(paragraph()) });
//     editor.execute(Commands.jump({ to: { path: "0", orientation: On } }));
//     editor.execute(Commands.insert({ inline: inlineUrlLink("test.com", "ABC") }));
//     expect(nodeToXml(editor.state.document.children[0]!)).toMatchInlineSnapshot(`
//               "<PARAGRAPH>
//                 <URL_LINK test.com>ABC</URL_LINK>
//               </PARAGRAPH>
//               "
//           `);
//     expect(debugState(editor)).toEqual(`
// CURSOR: 0/0 |>
// SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
//   });

//   // ---------------------------------------------------------------------------
//   // Insertion at the Inline Level
//   // ---------------------------------------------------------------------------

//   it("before an inline url link", () => {
//     const editor = CommandsTestUtils.getEditorForBasicDoc();
//     editor.execute(Commands.jump({ to: { path: "4/0", orientation: Before } }));
//     editor.execute(Commands.insert({ inline: inlineUrlLink("test.com", "ABC") }));

//     expect(debugState(editor)).toEqual(`
// CURSOR: 4/0/2 |>
// SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);

//     // Check that prior and later content elements are what we expect
//     expect(debugCurrentBlock(editor)).toEqual(`
// PARAGRAPH > URL_LINK test.com > "ABC"
// PARAGRAPH > URL_LINK e.com > "EE"
// PARAGRAPH > URL_LINK f.com > "FF"`);
//   });

//   it("between inline url links", () => {
//     const editor = CommandsTestUtils.getEditorForBasicDoc();
//     editor.execute(Commands.jump({ to: { path: "4/1", orientation: Before } }));
//     editor.execute(Commands.insert({ inline: inlineUrlLink("test.com", "ABC") }));

//     expect(debugState(editor)).toEqual(`
// CURSOR: 4/1/2 |>
// SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);

//     // Check that prior and later content elements are what we expect
//     expect(debugCurrentBlock(editor)).toEqual(`
// PARAGRAPH > URL_LINK e.com > "EE"
// PARAGRAPH > URL_LINK test.com > "ABC"
// PARAGRAPH > URL_LINK f.com > "FF"`);
//   });

//   it("after inline url links", () => {
//     let editor = new Editor({ document: testDoc1 });
//     editor.execute(Commands.jump({ to: { path: "4/0", orientation: After } }));
//     editor.execute(Commands.insert({ inline: inlineUrlLink("test.com", "ABC") }));

//     expect(debugState(editor)).toEqual(`
// CURSOR: 4/1/2 |>
// SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);

//     // Check that prior and later content elements are what we expect
//     expect(debugCurrentBlock(editor)).toEqual(`
// PARAGRAPH > URL_LINK e.com > "EE"
// PARAGRAPH > URL_LINK test.com > "ABC"
// PARAGRAPH > URL_LINK f.com > "FF"`);

//     editor = new Editor({ document: testDoc1 });
//     editor.execute(Commands.jump({ to: { path: "4/1", orientation: After } }));
//     editor.execute(Commands.insert({ inline: inlineUrlLink("test.com", "ABC") }));

//     expect(debugState(editor)).toEqual(`
// CURSOR: 4/2/2 |>
// SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);

//     // Check that prior and later content elements are what we expect
//     expect(debugCurrentBlock(editor)).toEqual(`
// PARAGRAPH > URL_LINK e.com > "EE"
// PARAGRAPH > URL_LINK f.com > "FF"
// PARAGRAPH > URL_LINK test.com > "ABC"`);
//   });

//   // ---------------------------------------------------------------------------
//   // Insertion at the Grapheme Level
//   // ---------------------------------------------------------------------------

//   it("into the middle of a inline text with before orientation", () => {
//     const editor = CommandsTestUtils.getEditorForBasicDoc();
//     // This is putting the cursor in the middle of the NNN inline text
//     editor.execute(Commands.jump({ to: { path: "1/2/1", orientation: Before } }));
//     editor.execute(Commands.insert({ inline: inlineUrlLink("test.com", "ABC") }));
//     expect(debugCurrentBlock(editor)).toEqual(`
// PARAGRAPH > TEXT {} > "MMM"
// PARAGRAPH > TEXT {} > ""
// PARAGRAPH > TEXT {} > "N"
// PARAGRAPH > URL_LINK test.com > "ABC"
// PARAGRAPH > TEXT {} > "NN"`);
//     expect(debugState(editor)).toEqual(`
// CURSOR: 1/3/2 |>
// SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
//   });

//   it("into the middle of a inline text with after orientation", () => {
//     const editor = CommandsTestUtils.getEditorForBasicDoc();
//     // This is putting the cursor in the middle of the NNN inline text
//     editor.execute(Commands.jump({ to: { path: "1/2/1", orientation: After } }));
//     editor.execute(Commands.insert({ inline: inlineUrlLink("test.com", "ABC") }));
//     expect(debugState(editor)).toEqual(`
// CURSOR: 1/3/2 |>
// SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
//     // Check that prior and later content elements are what we expect
//     expect(debugCurrentBlock(editor)).toEqual(`
// PARAGRAPH > TEXT {} > "MMM"
// PARAGRAPH > TEXT {} > ""
// PARAGRAPH > TEXT {} > "NN"
// PARAGRAPH > URL_LINK test.com > "ABC"
// PARAGRAPH > TEXT {} > "N"`);
//   });

//   it("at the beginning of an inline text", () => {
//     const editor = CommandsTestUtils.getEditorForBasicDoc();
//     editor.execute(Commands.jump({ to: { path: "1/0/0", orientation: Before } }));
//     editor.execute(Commands.insert({ inline: inlineUrlLink("test.com", "ABC") }));
//     expect(debugCurrentBlock(editor)).toEqual(`
// PARAGRAPH > URL_LINK test.com > "ABC"
// PARAGRAPH > TEXT {} > "MMM"
// PARAGRAPH > TEXT {} > ""
// PARAGRAPH > TEXT {} > "NNN"`);
//     expect(debugState(editor)).toEqual(`
// CURSOR: 1/0/2 |>
// SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
//   });

//   it("at the end of an inline text", () => {
//     const editor = CommandsTestUtils.getEditorForBasicDoc();
//     editor.execute(Commands.jump({ to: { path: "1/2/2", orientation: After } }));
//     editor.execute(Commands.insert({ inline: inlineUrlLink("test.com", "ABC") }));
//     expect(debugCurrentBlock(editor)).toEqual(`
// PARAGRAPH > TEXT {} > "MMM"
// PARAGRAPH > TEXT {} > ""
// PARAGRAPH > TEXT {} > "NNN"
// PARAGRAPH > URL_LINK test.com > "ABC"`);
//     expect(debugState(editor)).toEqual(`
// CURSOR: 1/3/2 |>
// SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
//   });

//   it("should insert between two inline texts", () => {
//     const editor = new Editor({ document: doc(paragraph(inlineText("AA"), inlineText("BB"))) });
//     editor.execute(Commands.jump({ to: { path: "0/0/1", orientation: After } }));
//     editor.execute(Commands.insert({ inline: inlineUrlLink("test.com", "ABC") }));
//     expect(debugCurrentBlock(editor)).toEqual(`
// PARAGRAPH > TEXT {} > "AA"
// PARAGRAPH > URL_LINK test.com > "ABC"
// PARAGRAPH > TEXT {} > "BB"`);
//     expect(debugState(editor)).toEqual(`
// CURSOR: 0/1/2 |>
// SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
//   });

//   it("around an inline inline text when the orientation is on link", () => {
//     const editor = CommandsTestUtils.getEditorForBasicDoc();
//     editor.execute(Commands.jump({ to: { path: "1/1", orientation: On } }));
//     editor.execute(Commands.insert({ inline: inlineUrlLink("test.com", "ABC") }));

//     expect(nodeToXml(editor.state.document.children[1]!)).toMatchInlineSnapshot(`
//         "<PARAGRAPH>
//           <TEXT>MMM</TEXT>
//           <TEXT></TEXT>
//           <URL_LINK test.com>ABC</URL_LINK>
//           <TEXT>NNN</TEXT>
//         </PARAGRAPH>
//         "
//       `);

//     expect(debugState(editor)).toEqual(`
// CURSOR: 1/2/2 |>
// SLICE:  PARAGRAPH > URL_LINK test.com > "ABC"`);
//   });
// });

// describe("insert should insert a Header", () => {
// });

// describe("insert should insert a Span", () => {
// });
