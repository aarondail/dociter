import { AnchorOrientation } from "../../src/document-model-rd5";
import { NodeId, ReadonlyWorkingAnchor, ReadonlyWorkingNode, WorkingDocument } from "../../src/working-document-rd4";
import { docToXmlish, dumpAnchorsFromWorkingDocument, testDoc } from "../utils-rd4";

import { WorkingDocumentTestUtils } from "./workingDocument.testUtils";

describe("splitNodeAtPath", () => {
  it("is a no-op on a Span", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.splitNodeAtPath("1/0", [2]);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>
      "
    `);
  });

  it("works on an Hyperlink (middle)", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.splitNodeAtPath("3/1", [3]);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOO</hyperlink> <hyperlink url=g.com>GLE</hyperlink> <s>DD</s> </p>
      "
    `);
  });

  it("no-op on Hyperlink first character", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.splitNodeAtPath("3/1", [0]);
    // wd.splitNodeAtPath("3/1", [5]);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>
      "
    `);
  });

  it("works on Hyperlink last character", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.splitNodeAtPath("3/1", [5]);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGL</hyperlink> <hyperlink url=g.com>E</hyperlink> <s>DD</s> </p>
      "
    `);
  });

  it("works on an Paragraph, targeting an empty Hyperlink", () => {
    const wd = new WorkingDocument(testDoc`<p> <s>A</s> <hyperlink url=test.com /> <s>B</s> </p>`);
    wd.splitNodeAtPath("0", [1]);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<p> <s>A</s> </p>
      <p> <hyperlink url=test.com></hyperlink> <s>B</s> </p>
      "
    `);
  });

  it("works on an Paragraph, targeting inside a Span", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.splitNodeAtPath("1", [0, 3]);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s>MMN</s> </p>
      <p> <s styles=3:+B>NAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>
      "
    `);
  });

  it("works on an Paragraph, targeting the edge of a Span", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.splitNodeAtPath("3", [2, 0]);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> </p>
      <p> <s>DD</s> </p>
      "
    `);
  });

  it("works on an Paragraph, targeting a Span directly", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.splitNodeAtPath("3", [2]);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> </p>
      <p> <s>DD</s> </p>
      "
    `);
  });

  it("works on an empty Paragraph", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    expect(() => wd.splitNodeAtPath("2", [])).toThrowErrorMatchingInlineSnapshot(
      `"Cannot split a node without specifying which child to split at"`
    );
  });

  it("works on the edge of a Paragraph", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.splitNodeAtPath("1", [0, 0]);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> </p>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>
      "
    `);
    // Note to future self, we should also be able to do this from the
    // later/right side of the paragraph...
  });

  it("works on a Header", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.splitNodeAtPath("0", [0, 1]);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>H</s> </h>
      <h level=ONE> <s styles=undefined>eader1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>
      "
    `);
  });

  it("fails on an Grapheme", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    expect(() => wd.splitNodeAtPath("0/0/1", [])).toThrowErrorMatchingInlineSnapshot(`"Cannot split on a Grapheme"`);
  });

  it("fails on the Document", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    expect(() => wd.splitNodeAtPath("", [0, 0, 1])).toThrowErrorMatchingInlineSnapshot(`"Cannot split the Document"`);
  });

  it("anchors are updated when splitting a Paragraph", () => {
    const wd = new WorkingDocument(testDoc`<p> <s styles=3:+B>ABCDEFG</s> </p>`);
    const spanNode = wd.document.children[0].children[0] as ReadonlyWorkingNode;

    wd.addAnchor({ name: "1", node: spanNode, orientation: AnchorOrientation.Before, graphemeIndex: 0 });
    wd.addAnchor({ name: "2", node: spanNode, orientation: AnchorOrientation.Before, graphemeIndex: 2 });
    wd.addAnchor({ name: "3", node: spanNode, orientation: AnchorOrientation.Before, graphemeIndex: 3 });
    wd.addAnchor({ name: "4", node: spanNode, orientation: AnchorOrientation.Before, graphemeIndex: 5 });
    wd.addAnchor({ name: "5", node: spanNode, orientation: AnchorOrientation.After, graphemeIndex: 0 });
    wd.addAnchor({ name: "6", node: spanNode, orientation: AnchorOrientation.After, graphemeIndex: 2 });
    wd.addAnchor({ name: "7", node: spanNode, orientation: AnchorOrientation.After, graphemeIndex: 3 });
    wd.addAnchor({ name: "8", node: spanNode, orientation: AnchorOrientation.After, graphemeIndex: 5 });

    wd.splitNodeAtPath("0", [0, 3]);

    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<p> <s>ABC</s> </p>
      <p> <s styles=0:+B>DEFG</s> </p>
      "
    `);
    expect(dumpAnchorsFromWorkingDocument(wd)).toMatchInlineSnapshot(`
      "Anchor: 1 BEFORE (Span:A)0/0⁙0 
      Anchor: 2 BEFORE (Span:C)0/0⁙2 
      Anchor: 3 BEFORE (Span:D)1/0⁙0 
      Anchor: 4 BEFORE (Span:F)1/0⁙2 
      Anchor: 5 AFTER (Span:A)0/0⁙0 
      Anchor: 6 AFTER (Span:C)0/0⁙2 
      Anchor: 7 AFTER (Span:D)1/0⁙0 
      Anchor: 8 AFTER (Span:F)1/0⁙2 
      "
    `);
  });
});
