import { Header, HeaderLevel, Paragraph } from "../../src/document-model";
import { WorkingDocument } from "../../src/working-document";
import { docToXmlish } from "../utils";

import { WorkingDocumentTestUtils } from "./workingDocument.testUtils";

describe("changeNodeType", () => {
  it("changes block types", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);

    wd.changeNodeType(wd.getNodeAtPath("0"), Paragraph, {});
    wd.changeNodeType(wd.getNodeAtPath("1"), Header, { level: HeaderLevel.One });
    wd.changeNodeType(wd.getNodeAtPath("2"), Header, { level: HeaderLevel.Two });

    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<p> <s>Header1</s> </p>
      <h level=ONE> <s styles=6:+B>MMNNAABB</s> </h>
      <h level=TWO> </h>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
    `);
  });
});
