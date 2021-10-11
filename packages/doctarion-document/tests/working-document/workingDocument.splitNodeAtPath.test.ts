import { HeaderLevel } from "../../src/document-model";
import { Anchor, AnchorOrientation, NodeId, WorkingDocument } from "../../src/working-document";
import { doc, header, inlineEmoji, inlineText, inlineUrlLink, nodeToXml, paragraph } from "../utils";

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"), inlineText("DD")),
  paragraph(inlineText("EE"), inlineEmoji("tree"), inlineText("FF"))
);

describe("WorkingDocument.splitNodeAtPath", () => {
  it("works on an InlineText (middle)", () => {
    const wd = new WorkingDocument(testDoc1);
    wd.splitNodeAtPath("1/2", [1]);
    expect(nodeToXml(wd.document.children[1]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>MM</TEXT>
        <TEXT></TEXT>
        <TEXT>N</TEXT>
        <TEXT>N</TEXT>
        <TEXT>AA</TEXT>
        <TEXT BOLD>BB</TEXT>
      </PARAGRAPH>
      "
    `);
  });

  it("works on an InlineText (edge)", () => {
    let wd = new WorkingDocument(testDoc1);
    wd.splitNodeAtPath("1/2", [0]);
    expect(nodeToXml(wd.document.children[1]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>MM</TEXT>
        <TEXT></TEXT>
        <TEXT>NN</TEXT>
        <TEXT>AA</TEXT>
        <TEXT BOLD>BB</TEXT>
      </PARAGRAPH>
      "
    `);

    wd = new WorkingDocument(testDoc1);
    expect(() => wd.splitNodeAtPath("1/2", [2])).toThrowErrorMatchingInlineSnapshot(
      `"Could not navigate to descendant of target"`
    );
  });

  it("works on an InlineText (empty)", () => {
    const wd = new WorkingDocument(testDoc1);
    wd.splitNodeAtPath("1", [1]);
    expect(nodeToXml(wd.document.children[1]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>MM</TEXT>
      </PARAGRAPH>
      "
    `);
    expect(nodeToXml(wd.document.children[2]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT></TEXT>
        <TEXT>NN</TEXT>
        <TEXT>AA</TEXT>
        <TEXT BOLD>BB</TEXT>
      </PARAGRAPH>
      "
    `);
  });

  it("works on an InlineUrlLink (middle)", () => {
    const wd = new WorkingDocument(testDoc1);
    wd.splitNodeAtPath("3/1", [3]);
    expect(nodeToXml(wd.document.children[3]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>CC</TEXT>
        <URL_LINK g.com>GOO</URL_LINK>
        <URL_LINK g.com>GLE</URL_LINK>
        <TEXT>DD</TEXT>
      </PARAGRAPH>
      "
    `);
  });

  it("works on an InlineUrlLink (edge)", () => {
    const wd = new WorkingDocument(testDoc1);
    wd.splitNodeAtPath("3/1", [0]);
    expect(nodeToXml(wd.document.children[3]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>CC</TEXT>
        <URL_LINK g.com>GOOGLE</URL_LINK>
        <TEXT>DD</TEXT>
      </PARAGRAPH>
      "
    `);
  });

  it("works on an InlineEmoji", () => {
    let wd = new WorkingDocument(testDoc1);
    expect(() => wd.splitNodeAtPath("4/1", [])).toThrowErrorMatchingInlineSnapshot(
      `"Cannot split a node without specifying which child to split at"`
    );

    wd = new WorkingDocument(testDoc1);
    wd.splitNodeAtPath("4", [1]);

    expect(nodeToXml(wd.document.children[4]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>EE</TEXT>
      </PARAGRAPH>
      "
    `);
    expect(nodeToXml(wd.document.children[5]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <EMOJI tree />
        <TEXT>FF</TEXT>
      </PARAGRAPH>
      "
    `);
  });

  it("works on an Paragraph (middle)", () => {
    const wd = new WorkingDocument(testDoc1);
    wd.splitNodeAtPath("1", [2, 1]);
    expect(nodeToXml(wd.document.children[1]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>MM</TEXT>
        <TEXT></TEXT>
        <TEXT>N</TEXT>
      </PARAGRAPH>
      "
    `);
    expect(nodeToXml(wd.document.children[2]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>N</TEXT>
        <TEXT>AA</TEXT>
        <TEXT BOLD>BB</TEXT>
      </PARAGRAPH>
      "
    `);
  });

  it("works on an Paragraph (inner edge)", () => {
    const wd = new WorkingDocument(testDoc1);
    wd.splitNodeAtPath("1", [2, 0]);
    expect(nodeToXml(wd.document.children[1]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>MM</TEXT>
        <TEXT></TEXT>
      </PARAGRAPH>
      "
    `);
    expect(nodeToXml(wd.document.children[2]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>NN</TEXT>
        <TEXT>AA</TEXT>
        <TEXT BOLD>BB</TEXT>
      </PARAGRAPH>
      "
    `);
  });

  it("works on an Paragraph (empty inline)", () => {
    const wd = new WorkingDocument(testDoc1);
    wd.splitNodeAtPath("1", [1]);
    expect(nodeToXml(wd.document.children[1]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>MM</TEXT>
      </PARAGRAPH>
      "
    `);
    expect(nodeToXml(wd.document.children[2]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT></TEXT>
        <TEXT>NN</TEXT>
        <TEXT>AA</TEXT>
        <TEXT BOLD>BB</TEXT>
      </PARAGRAPH>
      "
    `);
  });

  it("works on an Paragraph (empty)", () => {
    const wd = new WorkingDocument(testDoc1);
    expect(() => wd.splitNodeAtPath("2", [])).toThrowErrorMatchingInlineSnapshot(
      `"Cannot split a node without specifying which child to split at"`
    );
  });

  it("works on an Paragraph (edge)", () => {
    const wd = new WorkingDocument(testDoc1);
    wd.splitNodeAtPath("1", [0, 0]);
    expect(nodeToXml(wd.document.children[1]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <TEXT>MM</TEXT>
        <TEXT></TEXT>
        <TEXT>NN</TEXT>
        <TEXT>AA</TEXT>
        <TEXT BOLD>BB</TEXT>
      </PARAGRAPH>
      "
    `);
  });

  it("works on an Header", () => {
    const wd = new WorkingDocument(testDoc1);
    wd.splitNodeAtPath("0", [0, 1]);
    expect(nodeToXml(wd.document.children[0]!)).toMatchInlineSnapshot(`
      "<HEADER>
        <TEXT>H</TEXT>
      </HEADER>
      "
    `);
    expect(nodeToXml(wd.document.children[1]!)).toMatchInlineSnapshot(`
      "<HEADER>
        <TEXT>1</TEXT>
      </HEADER>
      "
    `);
  });

  it("fails on an Grapheme", () => {
    const wd = new WorkingDocument(testDoc1);
    expect(() => wd.splitNodeAtPath("0/0/1", [])).toThrowErrorMatchingInlineSnapshot(`"Cannot split a Grapheme"`);
  });

  it("fails on the Document", () => {
    const wd = new WorkingDocument(testDoc1);
    expect(() => wd.splitNodeAtPath("", [0, 0, 1])).toThrowErrorMatchingInlineSnapshot(`"Cannot split the Document "`);
  });

  it("anchors are updated when splitting a Paragraph", () => {
    const wd = new WorkingDocument(
      doc(paragraph(inlineEmoji("tree"), inlineText("ABCDEF"), inlineText("Z", { bold: true })))
    );

    const emojiId = wd.getId(wd.document.children[0]!.children[0]!);
    const inlineId = wd.getId(wd.document.children[0]!.children[1]!);

    const emojiAnchor = wd.addAnchor(wd.document.children[0]!.children[0]!, AnchorOrientation.On);
    const textAAnchorBefore = wd.addAnchor(wd.document.children[0]!.children[1]!, AnchorOrientation.Before, 0);
    const textCAnchorBefore = wd.addAnchor(wd.document.children[0]!.children[1]!, AnchorOrientation.Before, 2);
    const textDAnchorBefore = wd.addAnchor(wd.document.children[0]!.children[1]!, AnchorOrientation.Before, 3);
    const textFAnchorBefore = wd.addAnchor(wd.document.children[0]!.children[1]!, AnchorOrientation.Before, 5);
    const textAAnchorAfter = wd.addAnchor(wd.document.children[0]!.children[1]!, AnchorOrientation.After, 0);
    const textCAnchorAfter = wd.addAnchor(wd.document.children[0]!.children[1]!, AnchorOrientation.After, 2);
    const textDAnchorAfter = wd.addAnchor(wd.document.children[0]!.children[1]!, AnchorOrientation.After, 3);
    const textFAnchorAfter = wd.addAnchor(wd.document.children[0]!.children[1]!, AnchorOrientation.After, 5);

    wd.splitNodeAtPath("0", [1, 3]);

    const newInlineId = wd.getId(wd.document.children[1]!.children[0]!);

    expect(nodeToXml(wd.document.children[0]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <EMOJI tree />
        <TEXT>ABC</TEXT>
      </PARAGRAPH>
      "
    `);
    expect(nodeToXml(wd.document.children[1]!)).toMatchInlineSnapshot(`
          "<PARAGRAPH>
            <TEXT>DEF</TEXT>
            <TEXT BOLD>Z</TEXT>
          </PARAGRAPH>
          "
      `);

    const checkAnchor = (oldA: Anchor, nodeId?: NodeId, orientation?: AnchorOrientation, graphemeIndex?: number) => {
      const a = wd.getAnchor(oldA.id);
      expect(a?.nodeId).toEqual(nodeId);
      expect(a?.orientation).toEqual(orientation);
      expect(a?.graphemeIndex).toEqual(graphemeIndex);
    };
    checkAnchor(emojiAnchor, emojiId, AnchorOrientation.On, undefined);
    checkAnchor(textAAnchorBefore, inlineId, AnchorOrientation.Before, 0);
    checkAnchor(textCAnchorBefore, inlineId, AnchorOrientation.Before, 2);
    checkAnchor(textDAnchorBefore, newInlineId, AnchorOrientation.Before, 0);
    checkAnchor(textFAnchorBefore, newInlineId, AnchorOrientation.Before, 2);
    checkAnchor(textAAnchorAfter, inlineId, AnchorOrientation.After, 0);
    checkAnchor(textCAnchorAfter, inlineId, AnchorOrientation.After, 2);
    checkAnchor(textDAnchorAfter, newInlineId, AnchorOrientation.After, 0);
    checkAnchor(textFAnchorAfter, newInlineId, AnchorOrientation.After, 2);
  });

  it("anchors are updated when after a split InlineText", () => {
    const wd = new WorkingDocument(
      doc(paragraph(inlineEmoji("tree"), inlineText("ABCDEF"), inlineText("Z", { bold: true })))
    );

    const inlineId = wd.getId(wd.document.children[0]!.children[1]!);

    const textAAnchorBefore = wd.addAnchor(wd.document.children[0]!.children[1]!, AnchorOrientation.Before, 0);
    const textCAnchorBefore = wd.addAnchor(wd.document.children[0]!.children[1]!, AnchorOrientation.Before, 2);
    const textDAnchorBefore = wd.addAnchor(wd.document.children[0]!.children[1]!, AnchorOrientation.Before, 3);
    const textFAnchorBefore = wd.addAnchor(wd.document.children[0]!.children[1]!, AnchorOrientation.Before, 5);
    const textAAnchorAfter = wd.addAnchor(wd.document.children[0]!.children[1]!, AnchorOrientation.After, 0);
    const textCAnchorAfter = wd.addAnchor(wd.document.children[0]!.children[1]!, AnchorOrientation.After, 2);
    const textDAnchorAfter = wd.addAnchor(wd.document.children[0]!.children[1]!, AnchorOrientation.After, 3);
    const textFAnchorAfter = wd.addAnchor(wd.document.children[0]!.children[1]!, AnchorOrientation.After, 5);

    wd.splitNodeAtPath("0/1", [3]);

    const newInlineId = wd.getId(wd.document.children[0]!.children[2]!);

    expect(nodeToXml(wd.document.children[0]!)).toMatchInlineSnapshot(`
      "<PARAGRAPH>
        <EMOJI tree />
        <TEXT>ABC</TEXT>
        <TEXT>DEF</TEXT>
        <TEXT BOLD>Z</TEXT>
      </PARAGRAPH>
      "
    `);

    const checkAnchor = (oldA: Anchor, nodeId?: NodeId, orientation?: AnchorOrientation, graphemeIndex?: number) => {
      const a = wd.getAnchor(oldA.id);
      expect(a?.nodeId).toEqual(nodeId);
      expect(a?.orientation).toEqual(orientation);
      expect(a?.graphemeIndex).toEqual(graphemeIndex);
    };
    checkAnchor(textAAnchorBefore, inlineId, AnchorOrientation.Before, 0);
    checkAnchor(textCAnchorBefore, inlineId, AnchorOrientation.Before, 2);
    checkAnchor(textDAnchorBefore, newInlineId, AnchorOrientation.Before, 0);
    checkAnchor(textFAnchorBefore, newInlineId, AnchorOrientation.Before, 2);
    checkAnchor(textAAnchorAfter, inlineId, AnchorOrientation.After, 0);
    checkAnchor(textCAnchorAfter, inlineId, AnchorOrientation.After, 2);
    checkAnchor(textDAnchorAfter, newInlineId, AnchorOrientation.After, 0);
    checkAnchor(textFAnchorAfter, newInlineId, AnchorOrientation.After, 2);
  });
});
