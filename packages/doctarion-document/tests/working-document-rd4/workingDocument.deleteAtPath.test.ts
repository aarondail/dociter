import { WorkingDocument } from "../../src/working-document-rd4";
import { docToXmlish } from "../utils-rd4";

import { WorkingDocumentTestUtils } from "./workingDocument.testUtils";

describe("deleteNodeAtPath", () => {
  it("basically works", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.deleteAtPath("0/0/1");
    wd.deleteAtPath("1/0/0");
    wd.deleteAtPath("1/0/3");
    wd.deleteAtPath("1/0/5");
    wd.deleteAtPath("2");
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Hader1</s> </h>
      <p> <s styles=6:+B>MNNAB</s> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
    `);
  });

  it("deleting document works correctly", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.deleteAtPath("");
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`""`);
  });

  it("merge spans that can be merged", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.deleteAtPath("0");
    wd.deleteAtPath("0");
    wd.deleteAtPath("0");
    // This is the important
    wd.deleteAtPath("0/1");
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`"<p> <s>CCDD</s> </p>"`);
  });
});
