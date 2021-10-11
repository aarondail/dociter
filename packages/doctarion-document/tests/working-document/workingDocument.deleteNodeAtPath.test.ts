import { HeaderLevel } from "../../src/document-model";
import { WorkingDocument } from "../../src/working-document";
import { doc, header, inlineText, inlineUrlLink, nodeToXml, paragraph } from "../utils";

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"), inlineText("DD"))
);

describe("WorkingDocument.deleteNodeAtPath", () => {
  it("basically works", () => {
    const wd = new WorkingDocument(testDoc1);
    wd.deleteNodeAtPath("0/0/1");
    expect(nodeToXml(wd.document.children[0]!)).toMatchInlineSnapshot(`
      "<HEADER>
        <TEXT>H</TEXT>
      </HEADER>
      "
    `);

    wd.deleteNodeAtPath("1/1");
    wd.deleteNodeAtPath("1/1/0");
    wd.deleteNodeAtPath("1/3");
    expect(nodeToXml(wd.document.children[1]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>MM</TEXT>
        <TEXT>N</TEXT>
        <TEXT>AA</TEXT>
      </PARAGRAPH>
      "
    `);

    wd.deleteNodeAtPath("2");
    wd.deleteNodeAtPath("2/1/3");
    expect(nodeToXml(wd.document.children[2]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>CC</TEXT>
        <URL_LINK g.com>GOOLE</URL_LINK>
        <TEXT>DD</TEXT>
      </PARAGRAPH>
      "
    `);
  });

  it("deleting document works correctly", () => {
    const wd = new WorkingDocument(testDoc1);
    wd.deleteNodeAtPath("");
    expect(nodeToXml(wd.document)).toMatchInlineSnapshot(`
      "<DOCUMENT>
      </DOCUMENT>
      "
    `);
  });
});
