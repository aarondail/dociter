import { NodeNavigator } from "../../src/traversal-rd4";
import { testDoc } from "../utils-rd4";

const testDoc1 = testDoc`
<h level=ONE> <s>Header1</s> </h>
<p> <s>Here is some text</s> <s>MORE</s> <s>last</s> </p>
<p> <s>Paragraph 2</s> <hyperlink url=g.com>GOOG</hyperlink> <s>final sentence</s> </p>
`;

test("navigateTo", () => {
  const nav = new NodeNavigator(testDoc1);
  nav.navigateTo("1");
  expect(nav.path.toString()).toMatchInlineSnapshot(`"1"`);
  expect(nav.navigateTo("1/1/2")).toBeTruthy();
  expect(nav.path.toString()).toMatchInlineSnapshot(`"1/1/2"`);
  expect(nav.tip.node).toEqual("R");
  expect(nav.navigateTo("1/2/0")).toBeTruthy();
  expect(nav.tip.node).toEqual("l");

  // Navigate to root
  nav.navigateTo("");
  expect(nav.path.toString()).toEqual(``);
  expect(nav.tip.node).toBe(testDoc1);
});

test("navigateToPrecedingSibling", () => {
  const nav = new NodeNavigator(testDoc1);
  nav.navigateTo("1/2/2");
  expect(nav.tip.node).toEqual("s"); // of last
  expect(nav.navigateToPrecedingSibling()).toBeTruthy();
  expect(nav.tip.node).toEqual("a"); // of last
  expect(nav.navigateToPrecedingSibling()).toBeTruthy();
  expect(nav.tip.node).toEqual("l"); // of last
  expect(nav.navigateToPrecedingSibling()).toBeFalsy();
});

test("navigateToNextSibling", () => {
  const nav = new NodeNavigator(testDoc1);
  nav.navigateTo("1/2/2");
  expect(nav.tip.node).toEqual("s"); // of last
  expect(nav.navigateToNextSibling()).toBeTruthy();
  expect(nav.tip.node).toEqual("t"); // of last
  expect(nav.navigateToNextSibling()).toBeFalsy();
});

test("navigateForwardsByDfs", () => {
  const navigateUntilEndAndCollectPaths = (nav: NodeNavigator) => {
    const paths = [];
    while (nav.navigateForwardsByDfs()) {
      paths.push(nav.path.toString());
    }
    return paths;
  };

  let nav = new NodeNavigator(testDoc``);
  expect(nav.navigateForwardsByDfs()).toBeFalsy();

  nav = new NodeNavigator(testDoc`<p></p>`);
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "0",
    ]
  `);

  nav = new NodeNavigator(testDoc`<p><s>ABC</s></p>`);
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "0",
      "0/0",
      "0/0/0",
      "0/0/1",
      "0/0/2",
    ]
  `);

  nav = new NodeNavigator(testDoc`<p><s>AB</s><s>CD</s></p>`);
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "0",
      "0/0",
      "0/0/0",
      "0/0/1",
      "0/1",
      "0/1/0",
      "0/1/1",
    ]
  `);

  nav = new NodeNavigator(testDoc1);
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "0",
      "0/0",
      "0/0/0",
      "0/0/1",
      "0/0/2",
      "0/0/3",
      "0/0/4",
      "0/0/5",
      "0/0/6",
      "1",
      "1/0",
      "1/0/0",
      "1/0/1",
      "1/0/2",
      "1/0/3",
      "1/0/4",
      "1/0/5",
      "1/0/6",
      "1/0/7",
      "1/0/8",
      "1/0/9",
      "1/0/10",
      "1/0/11",
      "1/0/12",
      "1/0/13",
      "1/0/14",
      "1/0/15",
      "1/0/16",
      "1/1",
      "1/1/0",
      "1/1/1",
      "1/1/2",
      "1/1/3",
      "1/2",
      "1/2/0",
      "1/2/1",
      "1/2/2",
      "1/2/3",
      "2",
      "2/0",
      "2/0/0",
      "2/0/1",
      "2/0/2",
      "2/0/3",
      "2/0/4",
      "2/0/5",
      "2/0/6",
      "2/0/7",
      "2/0/8",
      "2/0/9",
      "2/0/10",
      "2/1",
      "2/1/0",
      "2/1/1",
      "2/1/2",
      "2/1/3",
      "2/2",
      "2/2/0",
      "2/2/1",
      "2/2/2",
      "2/2/3",
      "2/2/4",
      "2/2/5",
      "2/2/6",
      "2/2/7",
      "2/2/8",
      "2/2/9",
      "2/2/10",
      "2/2/11",
      "2/2/12",
      "2/2/13",
    ]
  `);
});

test("navigateReverseOfForwardsByDfs", () => {
  const navigateUntilEndAndCollectPaths = (nav: NodeNavigator) => {
    const paths = [];
    while (nav.navigateReverseOfForwardsByDfs()) {
      paths.push(nav.path.toString());
    }
    return paths;
  };

  let nav = new NodeNavigator(testDoc``);
  expect(nav.navigateForwardsByDfs()).toBeFalsy();

  nav = new NodeNavigator(testDoc`<p></p>`);
  nav.navigateToEndOfDfs();
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "",
    ]
  `);

  nav = new NodeNavigator(testDoc`<p><s>ABC</s></p>`);
  nav.navigateToEndOfDfs();
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "0/0/1",
      "0/0/0",
      "0/0",
      "0",
      "",
    ]
  `);

  nav = new NodeNavigator(testDoc`<p><s>AB</s><s>CD</s></p>`);
  nav.navigateToEndOfDfs();
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "0/1/0",
      "0/1",
      "0/0/1",
      "0/0/0",
      "0/0",
      "0",
      "",
    ]
  `);

  nav = new NodeNavigator(testDoc1);
  nav.navigateToEndOfDfs();
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "2/2/12",
      "2/2/11",
      "2/2/10",
      "2/2/9",
      "2/2/8",
      "2/2/7",
      "2/2/6",
      "2/2/5",
      "2/2/4",
      "2/2/3",
      "2/2/2",
      "2/2/1",
      "2/2/0",
      "2/2",
      "2/1/3",
      "2/1/2",
      "2/1/1",
      "2/1/0",
      "2/1",
      "2/0/10",
      "2/0/9",
      "2/0/8",
      "2/0/7",
      "2/0/6",
      "2/0/5",
      "2/0/4",
      "2/0/3",
      "2/0/2",
      "2/0/1",
      "2/0/0",
      "2/0",
      "2",
      "1/2/3",
      "1/2/2",
      "1/2/1",
      "1/2/0",
      "1/2",
      "1/1/3",
      "1/1/2",
      "1/1/1",
      "1/1/0",
      "1/1",
      "1/0/16",
      "1/0/15",
      "1/0/14",
      "1/0/13",
      "1/0/12",
      "1/0/11",
      "1/0/10",
      "1/0/9",
      "1/0/8",
      "1/0/7",
      "1/0/6",
      "1/0/5",
      "1/0/4",
      "1/0/3",
      "1/0/2",
      "1/0/1",
      "1/0/0",
      "1/0",
      "1",
      "0/0/6",
      "0/0/5",
      "0/0/4",
      "0/0/3",
      "0/0/2",
      "0/0/1",
      "0/0/0",
      "0/0",
      "0",
      "",
    ]
  `);
});

test("navigateBackwardsByDfs", () => {
  const navigateUntilEndAndCollectPaths = (nav: NodeNavigator) => {
    const paths = [];
    while (nav.navigateBackwardsByDfs()) {
      paths.push(nav.path.toString());
    }
    return paths;
  };

  let nav = new NodeNavigator(testDoc`<p></p>`);
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "0",
    ]
  `);

  nav = new NodeNavigator(testDoc`<p><s>ABC</s></p>`);
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "0",
      "0/0",
      "0/0/2",
      "0/0/1",
      "0/0/0",
    ]
  `);

  nav = new NodeNavigator(testDoc`<p><s>AB</s><s>CD</s></p>`);
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "0",
      "0/1",
      "0/1/1",
      "0/1/0",
      "0/0",
      "0/0/1",
      "0/0/0",
    ]
  `);

  nav = new NodeNavigator(testDoc1);
  expect(navigateUntilEndAndCollectPaths(nav)).toMatchInlineSnapshot(`
    Array [
      "2",
      "2/2",
      "2/2/13",
      "2/2/12",
      "2/2/11",
      "2/2/10",
      "2/2/9",
      "2/2/8",
      "2/2/7",
      "2/2/6",
      "2/2/5",
      "2/2/4",
      "2/2/3",
      "2/2/2",
      "2/2/1",
      "2/2/0",
      "2/1",
      "2/1/3",
      "2/1/2",
      "2/1/1",
      "2/1/0",
      "2/0",
      "2/0/10",
      "2/0/9",
      "2/0/8",
      "2/0/7",
      "2/0/6",
      "2/0/5",
      "2/0/4",
      "2/0/3",
      "2/0/2",
      "2/0/1",
      "2/0/0",
      "1",
      "1/2",
      "1/2/3",
      "1/2/2",
      "1/2/1",
      "1/2/0",
      "1/1",
      "1/1/3",
      "1/1/2",
      "1/1/1",
      "1/1/0",
      "1/0",
      "1/0/16",
      "1/0/15",
      "1/0/14",
      "1/0/13",
      "1/0/12",
      "1/0/11",
      "1/0/10",
      "1/0/9",
      "1/0/8",
      "1/0/7",
      "1/0/6",
      "1/0/5",
      "1/0/4",
      "1/0/3",
      "1/0/2",
      "1/0/1",
      "1/0/0",
      "0",
      "0/0",
      "0/0/6",
      "0/0/5",
      "0/0/4",
      "0/0/3",
      "0/0/2",
      "0/0/1",
      "0/0/0",
    ]
  `);
});
