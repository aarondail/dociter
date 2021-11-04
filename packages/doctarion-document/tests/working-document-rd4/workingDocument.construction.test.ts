import {
  Anchor,
  AnchorOrientation,
  AnchorRange,
  Document,
  Floater,
  FloaterPlacement,
  Node,
  Sidebar,
  Span,
} from "../../src/document-model-rd5";
import { Text } from "../../src/text-model-rd4";
import { WorkingDocument } from "../../src/working-document-rd4";
import { docToXmlish, dumpAnchorsFromWorkingDocument, testDoc } from "../utils-rd4";

import { WorkingDocumentTestUtils } from "./workingDocument.testUtils";

describe("construction", () => {
  it("basically works", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>
      "
    `);
  });

  it("properly creates anchors", () => {
    let doc = WorkingDocumentTestUtils.testDocs.basicDoc;
    doc = new Node(Document, doc.children, {
      annotations: [
        new Node(Floater, [new Node(Span, Text.fromString("test"), {})], {
          anchors: new AnchorRange(
            new Anchor(doc.children[1].children[0] as any, AnchorOrientation.Before, 2),
            new Anchor(doc.children[1].children[0] as any, AnchorOrientation.After, 4)
          ),
          placement: FloaterPlacement.Above,
        }),
      ],
      laterals: [
        new Node(Sidebar, [new Node(Span, Text.fromString("test2"), {})], {
          anchor: new Anchor(doc.children[3].children[2] as any, AnchorOrientation.On),
        }),
      ],
    });
    const wd = new WorkingDocument(doc);
    expect(dumpAnchorsFromWorkingDocument(wd)).toMatchInlineSnapshot(`
      "Anchor: ∅ BEFORE (Span)1/0᠃2 from: (Floater)annotations:0
      Anchor: ∅ AFTER (Span)1/0᠃4 from: (Floater)annotations:0
      Anchor: ∅ ON (Span)3/2 from: (Sidebar)laterals:0
      "
    `);
  });

  it("merges spans that can be merged", () => {
    const docWithSpansToMerge = testDoc`
    <h level=ONE> <s>Header1</s> </h>
    <p> <s>Here is some text</s> <s>MORE</s> <s>last</s> </p>
    <p> <s>Paragraph 2</s> <hyperlink url=g.com>GOOG</hyperlink> <s>final sentence</s> </p>
    `;
  });
});
