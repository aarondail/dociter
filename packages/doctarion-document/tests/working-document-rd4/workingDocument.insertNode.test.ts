import { Node, Span } from "../../src/document-model-rd5";
import { Text } from "../../src/text-model-rd4";
import { WorkingDocument } from "../../src/working-document-rd4";
import { docToXmlish } from "../utils-rd4";

import { WorkingDocumentTestUtils } from "./workingDocument.testUtils";

describe("insertNode", () => {
  it("merges spans that can be merged", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);

    wd.insertNode(wd.getNodeAtPath("1"), new Node(Span, Text.fromString("xyz"), {}), 0);
    wd.insertNode(wd.getNodeAtPath("1"), new Node(Span, Text.fromString("zyx"), {}), 1);
    wd.insertNode(wd.getNodeAtPath("3"), new Node(Span, Text.fromString("zyx"), {}), 1);
    wd.insertNode(wd.getNodeAtPath("3"), new Node(Span, Text.fromString("xyz"), {}), 0);
    wd.insertNode(wd.getNodeAtPath("2"), new Node(Span, Text.fromString("xyz"), {}), 0);

    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=9:+B,11:-B>xyzMMNNAABBzyx</s> </p>
      <p> <s>xyz</s> </p>
      <p> <s>xyzCCzyx</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>
      "
    `);
  });
});
