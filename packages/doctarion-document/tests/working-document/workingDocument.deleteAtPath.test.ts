import { WorkingDocument } from "../../src";
import { docToXmlish } from "../test-utils";

import { WorkingDocumentTestUtils } from "./workingDocument.testUtils";

describe("deleteAtPath", () => {
  it("basically works", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    wd.deleteAtPath("0/0/1");
    wd.deleteAtPath("1/0/0");
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Hader1</s> </h>
      <p> <s styles=5:+B>MNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
    wd.deleteAtPath("1/0/3");
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Hader1</s> </h>
      <p> <s styles=4:+B>MNNABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
    wd.deleteAtPath("1/0/5");
    wd.deleteAtPath("2");
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Hader1</s> </h>
      <p> <s styles=4:+B>MNNAB</s> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
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
