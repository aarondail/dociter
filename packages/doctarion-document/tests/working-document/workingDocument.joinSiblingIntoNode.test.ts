import { AnchorOrientation, FlowDirection, WorkingDocument } from "../../src";
import { docToXmlish, dumpAnchorsFromWorkingDocument } from "../test-utils";

import { WorkingDocumentTestUtils } from "./workingDocument.testUtils";

describe("joinSiblingIntoNode", () => {
  it("works on Paragraphs backwards and merges Spans", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.joinSiblingIntoNode(wd.document.children[3], FlowDirection.Backward);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
    `);
    wd.joinSiblingIntoNode(wd.document.children[2], FlowDirection.Backward);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B,8:-B>MMNNAABBCC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
    `);
  });

  it("works on Paragraphs forwards and merges Spans", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.joinSiblingIntoNode(wd.document.children[1], FlowDirection.Forward);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
    `);
    wd.joinSiblingIntoNode(wd.document.children[1], FlowDirection.Forward);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B,8:-B>MMNNAABBCC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
    `);
  });

  it("updates anchors", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    const o = { orientation: AnchorOrientation.Before };

    wd.addAnchor({ ...o, name: "H", node: wd.getNodeAtPath("0/0"), graphemeIndex: 1 });
    wd.addAnchor({ ...o, name: "A", node: wd.getNodeAtPath("1/0"), graphemeIndex: 4 });
    wd.addAnchor({ ...o, name: "C", node: wd.getNodeAtPath("3/0"), graphemeIndex: 1 });
    wd.addAnchor({ ...o, name: "D", node: wd.getNodeAtPath("3/2"), graphemeIndex: 0 });

    wd.joinSiblingIntoNode(wd.getNodeAtPath("1"), FlowDirection.Forward);
    wd.joinSiblingIntoNode(wd.getNodeAtPath("1"), FlowDirection.Forward);

    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B,8:-B>MMNNAABBCC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(wd)).toMatchInlineSnapshot(`
      "Anchor: H BEFORE (Span:e)0/0⁙1 
      Anchor: A BEFORE (Span:A)1/0⁙4 
      Anchor: C BEFORE (Span:C)1/0⁙9 
      Anchor: D BEFORE (Span:D)1/2⁙0 "
    `);
  });

  // This doesn't make sense since Spans shouldn't be adjacent anyways
  // _ it("works on Spans", () => {});
  // These don't make sense because we disallow joining nodes of different types:
  // _ it("works on Headers", () => {});
  // _ it("works on Hyperlinks", () => {});
  // _ it("when targeting inlines, can merge newly adjacent Spans", () => {});
});
