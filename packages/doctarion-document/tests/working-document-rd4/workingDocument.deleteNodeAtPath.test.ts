import { WorkingDocument } from "../../src/working-document-rd4";
import { docToXmlish } from "../utils-rd4";

import { WorkingDocumentTestUtils } from "./workingDocument.testUtils";

describe("deleteNodeAtPath", () => {
  it("basically works", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.deleteNodeAtPath("0/0/1");
    wd.deleteNodeAtPath("1/0/0");
    wd.deleteNodeAtPath("1/0/3");
    wd.deleteNodeAtPath("1/0/5");
    wd.deleteNodeAtPath("2");
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Hader1</s> </h>
      <p> <s styles=6:+B>MNNAB</s> </p>
      <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>
      "
    `);
  });

  it("deleting document works correctly", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    expect(() => wd.deleteNodeAtPath("")).toThrow();
  });

  it("merge spans that can be merged", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.deleteNodeAtPath("0");
    wd.deleteNodeAtPath("0");
    wd.deleteNodeAtPath("0");
    // This is the important
    wd.deleteNodeAtPath("0/1");
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<p> <s>CCDD</s> </p>
      "
    `);
  });
});
