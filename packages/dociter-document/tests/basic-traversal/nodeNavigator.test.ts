import { NodeNavigator } from "../../src/basic-traversal/nodeNavigator";
import { Path, PathPartLabel } from "../../src/basic-traversal/path";
import * as Models from "../../src/models";
import { doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const testDoc1 = doc(
  header(Models.HeaderLevel.One, inlineText("Header1")),
  paragraph(inlineText("Here is some text"), inlineText("MORE"), inlineText("last")),
  paragraph(inlineText("Paragraph 2"), inlineUrlLink("http://google.com", "GOOG"), inlineText("final sentence"))
);

const debugPath = (nav: NodeNavigator) => Path.toString(nav.path);

test("navigateTo", () => {
  const nav = new NodeNavigator(testDoc1);
  nav.navigateTo([[PathPartLabel.Block, 1]]);
  expect(debugPath(nav)).toMatchInlineSnapshot(`"block:1"`);
  expect(
    nav.navigateTo([
      [PathPartLabel.Block, 1],
      [PathPartLabel.Content, 1],
      [PathPartLabel.CodePoint, 2],
    ])
  ).toBeTruthy();
  expect(debugPath(nav)).toMatchInlineSnapshot(`"block:1/content:1/cp:2"`);
  expect(nav.tip.node).toEqual("R");
  expect(nav.navigateTo("block:1/content:2/cp:0")).toBeTruthy();
  expect(nav.tip.node).toEqual("l");

  // Navigate to root
  nav.navigateTo([]);
  expect(debugPath(nav)).toEqual(``);
  expect(nav.tip.node).toBe(testDoc1);
});

test("navigateToPrecedingSibling", () => {
  const nav = new NodeNavigator(testDoc1);
  nav.navigateTo("block:1/content:2/cp:2");
  expect(nav.tip.node).toEqual("s"); // of last
  expect(nav.navigateToPrecedingSibling()).toBeTruthy();
  expect(nav.tip.node).toEqual("a"); // of last
  expect(nav.navigateToPrecedingSibling()).toBeTruthy();
  expect(nav.tip.node).toEqual("l"); // of last
  expect(nav.navigateToPrecedingSibling()).toBeFalsy();
});

test("navigateToNextSibling", () => {
  const nav = new NodeNavigator(testDoc1);
  nav.navigateTo("block:1/content:2/cp:2");
  expect(nav.tip.node).toEqual("s"); // of last
  expect(nav.navigateToNextSibling()).toBeTruthy();
  expect(nav.tip.node).toEqual("t"); // of last
  expect(nav.navigateToNextSibling()).toBeFalsy();
});

test("navigateForwardsInDfs", () => {
  const navigateUntilEndAndCollectPaths = (nav: NodeNavigator) => {
    const paths = [];
    while (nav.navigateForwardsInDfs()) {
      paths.push(debugPath(nav));
    }
    return paths;
  };

  let nav = new NodeNavigator(doc());
  expect(nav.navigateForwardsInDfs()).toBeFalsy();

  nav = new NodeNavigator(doc(paragraph()));
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "block:0",
    ]
  `);

  nav = new NodeNavigator(doc(paragraph(inlineText("ABC"))));
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "block:0",
      "block:0/content:0",
      "block:0/content:0/cp:0",
      "block:0/content:0/cp:1",
      "block:0/content:0/cp:2",
    ]
  `);

  nav = new NodeNavigator(doc(paragraph(inlineText("AB"), inlineText("CD"))));
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "block:0",
      "block:0/content:0",
      "block:0/content:0/cp:0",
      "block:0/content:0/cp:1",
      "block:0/content:1",
      "block:0/content:1/cp:0",
      "block:0/content:1/cp:1",
    ]
  `);

  nav = new NodeNavigator(testDoc1);
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "block:0",
      "block:0/content:0",
      "block:0/content:0/cp:0",
      "block:0/content:0/cp:1",
      "block:0/content:0/cp:2",
      "block:0/content:0/cp:3",
      "block:0/content:0/cp:4",
      "block:0/content:0/cp:5",
      "block:0/content:0/cp:6",
      "block:1",
      "block:1/content:0",
      "block:1/content:0/cp:0",
      "block:1/content:0/cp:1",
      "block:1/content:0/cp:2",
      "block:1/content:0/cp:3",
      "block:1/content:0/cp:4",
      "block:1/content:0/cp:5",
      "block:1/content:0/cp:6",
      "block:1/content:0/cp:7",
      "block:1/content:0/cp:8",
      "block:1/content:0/cp:9",
      "block:1/content:0/cp:10",
      "block:1/content:0/cp:11",
      "block:1/content:0/cp:12",
      "block:1/content:0/cp:13",
      "block:1/content:0/cp:14",
      "block:1/content:0/cp:15",
      "block:1/content:0/cp:16",
      "block:1/content:1",
      "block:1/content:1/cp:0",
      "block:1/content:1/cp:1",
      "block:1/content:1/cp:2",
      "block:1/content:1/cp:3",
      "block:1/content:2",
      "block:1/content:2/cp:0",
      "block:1/content:2/cp:1",
      "block:1/content:2/cp:2",
      "block:1/content:2/cp:3",
      "block:2",
      "block:2/content:0",
      "block:2/content:0/cp:0",
      "block:2/content:0/cp:1",
      "block:2/content:0/cp:2",
      "block:2/content:0/cp:3",
      "block:2/content:0/cp:4",
      "block:2/content:0/cp:5",
      "block:2/content:0/cp:6",
      "block:2/content:0/cp:7",
      "block:2/content:0/cp:8",
      "block:2/content:0/cp:9",
      "block:2/content:0/cp:10",
      "block:2/content:1",
      "block:2/content:1/cp:0",
      "block:2/content:1/cp:1",
      "block:2/content:1/cp:2",
      "block:2/content:1/cp:3",
      "block:2/content:2",
      "block:2/content:2/cp:0",
      "block:2/content:2/cp:1",
      "block:2/content:2/cp:2",
      "block:2/content:2/cp:3",
      "block:2/content:2/cp:4",
      "block:2/content:2/cp:5",
      "block:2/content:2/cp:6",
      "block:2/content:2/cp:7",
      "block:2/content:2/cp:8",
      "block:2/content:2/cp:9",
      "block:2/content:2/cp:10",
      "block:2/content:2/cp:11",
      "block:2/content:2/cp:12",
      "block:2/content:2/cp:13",
    ]
  `);
});

test("navigateReverseForwardsInDfs", () => {
  const navigateUntilEndAndCollectPaths = (nav: NodeNavigator) => {
    const paths = [];
    while (nav.navigateReverseForwardsInDfs()) {
      paths.push(debugPath(nav));
    }
    return paths;
  };

  let nav = new NodeNavigator(doc());
  expect(nav.navigateForwardsInDfs()).toBeFalsy();

  nav = new NodeNavigator(doc(paragraph()));
  nav.navigateToEndOfDfs();
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "",
    ]
  `);

  nav = new NodeNavigator(doc(paragraph(inlineText("ABC"))));
  nav.navigateToEndOfDfs();
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "block:0/content:0/cp:1",
      "block:0/content:0/cp:0",
      "block:0/content:0",
      "block:0",
      "",
    ]
  `);

  nav = new NodeNavigator(doc(paragraph(inlineText("AB"), inlineText("CD"))));
  nav.navigateToEndOfDfs();
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "block:0/content:1/cp:0",
      "block:0/content:1",
      "block:0/content:0/cp:1",
      "block:0/content:0/cp:0",
      "block:0/content:0",
      "block:0",
      "",
    ]
  `);

  nav = new NodeNavigator(testDoc1);
  nav.navigateToEndOfDfs();
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "block:2/content:2/cp:12",
      "block:2/content:2/cp:11",
      "block:2/content:2/cp:10",
      "block:2/content:2/cp:9",
      "block:2/content:2/cp:8",
      "block:2/content:2/cp:7",
      "block:2/content:2/cp:6",
      "block:2/content:2/cp:5",
      "block:2/content:2/cp:4",
      "block:2/content:2/cp:3",
      "block:2/content:2/cp:2",
      "block:2/content:2/cp:1",
      "block:2/content:2/cp:0",
      "block:2/content:2",
      "block:2/content:1/cp:3",
      "block:2/content:1/cp:2",
      "block:2/content:1/cp:1",
      "block:2/content:1/cp:0",
      "block:2/content:1",
      "block:2/content:0/cp:10",
      "block:2/content:0/cp:9",
      "block:2/content:0/cp:8",
      "block:2/content:0/cp:7",
      "block:2/content:0/cp:6",
      "block:2/content:0/cp:5",
      "block:2/content:0/cp:4",
      "block:2/content:0/cp:3",
      "block:2/content:0/cp:2",
      "block:2/content:0/cp:1",
      "block:2/content:0/cp:0",
      "block:2/content:0",
      "block:2",
      "block:1/content:2/cp:3",
      "block:1/content:2/cp:2",
      "block:1/content:2/cp:1",
      "block:1/content:2/cp:0",
      "block:1/content:2",
      "block:1/content:1/cp:3",
      "block:1/content:1/cp:2",
      "block:1/content:1/cp:1",
      "block:1/content:1/cp:0",
      "block:1/content:1",
      "block:1/content:0/cp:16",
      "block:1/content:0/cp:15",
      "block:1/content:0/cp:14",
      "block:1/content:0/cp:13",
      "block:1/content:0/cp:12",
      "block:1/content:0/cp:11",
      "block:1/content:0/cp:10",
      "block:1/content:0/cp:9",
      "block:1/content:0/cp:8",
      "block:1/content:0/cp:7",
      "block:1/content:0/cp:6",
      "block:1/content:0/cp:5",
      "block:1/content:0/cp:4",
      "block:1/content:0/cp:3",
      "block:1/content:0/cp:2",
      "block:1/content:0/cp:1",
      "block:1/content:0/cp:0",
      "block:1/content:0",
      "block:1",
      "block:0/content:0/cp:6",
      "block:0/content:0/cp:5",
      "block:0/content:0/cp:4",
      "block:0/content:0/cp:3",
      "block:0/content:0/cp:2",
      "block:0/content:0/cp:1",
      "block:0/content:0/cp:0",
      "block:0/content:0",
      "block:0",
      "",
    ]
  `);
});

test("navigateBackwardsInDfs", () => {
  const navigateUntilEndAndCollectPaths = (nav: NodeNavigator) => {
    const paths = [];
    while (nav.navigateBackwardsInDfs()) {
      paths.push(debugPath(nav));
    }
    return paths;
  };

  let nav = new NodeNavigator(doc());

  nav = new NodeNavigator(doc(paragraph()));
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "block:0",
    ]
  `);

  nav = new NodeNavigator(doc(paragraph(inlineText("ABC"))));
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "block:0",
      "block:0/content:0",
      "block:0/content:0/cp:2",
      "block:0/content:0/cp:1",
      "block:0/content:0/cp:0",
    ]
  `);

  nav = new NodeNavigator(doc(paragraph(inlineText("AB"), inlineText("CD"))));
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "block:0",
      "block:0/content:1",
      "block:0/content:1/cp:1",
      "block:0/content:1/cp:0",
      "block:0/content:0",
      "block:0/content:0/cp:1",
      "block:0/content:0/cp:0",
    ]
  `);

  nav = new NodeNavigator(testDoc1);
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "block:2",
      "block:2/content:2",
      "block:2/content:2/cp:13",
      "block:2/content:2/cp:12",
      "block:2/content:2/cp:11",
      "block:2/content:2/cp:10",
      "block:2/content:2/cp:9",
      "block:2/content:2/cp:8",
      "block:2/content:2/cp:7",
      "block:2/content:2/cp:6",
      "block:2/content:2/cp:5",
      "block:2/content:2/cp:4",
      "block:2/content:2/cp:3",
      "block:2/content:2/cp:2",
      "block:2/content:2/cp:1",
      "block:2/content:2/cp:0",
      "block:2/content:1",
      "block:2/content:1/cp:3",
      "block:2/content:1/cp:2",
      "block:2/content:1/cp:1",
      "block:2/content:1/cp:0",
      "block:2/content:0",
      "block:2/content:0/cp:10",
      "block:2/content:0/cp:9",
      "block:2/content:0/cp:8",
      "block:2/content:0/cp:7",
      "block:2/content:0/cp:6",
      "block:2/content:0/cp:5",
      "block:2/content:0/cp:4",
      "block:2/content:0/cp:3",
      "block:2/content:0/cp:2",
      "block:2/content:0/cp:1",
      "block:2/content:0/cp:0",
      "block:1",
      "block:1/content:2",
      "block:1/content:2/cp:3",
      "block:1/content:2/cp:2",
      "block:1/content:2/cp:1",
      "block:1/content:2/cp:0",
      "block:1/content:1",
      "block:1/content:1/cp:3",
      "block:1/content:1/cp:2",
      "block:1/content:1/cp:1",
      "block:1/content:1/cp:0",
      "block:1/content:0",
      "block:1/content:0/cp:16",
      "block:1/content:0/cp:15",
      "block:1/content:0/cp:14",
      "block:1/content:0/cp:13",
      "block:1/content:0/cp:12",
      "block:1/content:0/cp:11",
      "block:1/content:0/cp:10",
      "block:1/content:0/cp:9",
      "block:1/content:0/cp:8",
      "block:1/content:0/cp:7",
      "block:1/content:0/cp:6",
      "block:1/content:0/cp:5",
      "block:1/content:0/cp:4",
      "block:1/content:0/cp:3",
      "block:1/content:0/cp:2",
      "block:1/content:0/cp:1",
      "block:1/content:0/cp:0",
      "block:0",
      "block:0/content:0",
      "block:0/content:0/cp:6",
      "block:0/content:0/cp:5",
      "block:0/content:0/cp:4",
      "block:0/content:0/cp:3",
      "block:0/content:0/cp:2",
      "block:0/content:0/cp:1",
      "block:0/content:0/cp:0",
    ]
  `);
});
