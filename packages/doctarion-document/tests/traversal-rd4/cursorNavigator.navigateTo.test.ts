import { CursorNavigator, CursorOrientation } from "../../src/traversal-rd4";
import { testDoc } from "../utils-rd4";

import { CursorNavigatorTestUtils } from "./cursorNavigator.testUtils";

describe("navigateTo", () => {
  it("navigates to graphemes in a fleshed out doc", () => {
    const nav = new CursorNavigator(CursorNavigatorTestUtils.testDocs.basicDoc);
    nav.navigateTo("1/1/2", CursorOrientation.After);
    expect(nav.cursor.toString()).toEqual("AFTER 1/1/2");
    expect(nav.tip.node).toEqual("R");

    nav.navigateTo("0/0/0", CursorOrientation.Before);
    expect(nav.cursor.toString()).toEqual("BEFORE 0/0/0");
    expect(nav.tip.node).toEqual("H");

    nav.navigateTo("2/2/0", CursorOrientation.Before);
    expect(nav.cursor.toString()).toEqual("BEFORE 2/2/0");
    expect(nav.tip.node).toEqual("f");

    nav.navigateTo("2/2/13", CursorOrientation.After);
    expect(nav.cursor.toString()).toEqual("AFTER 2/2/13");
    expect(nav.tip.node).toEqual("e");

    // Note that orientation is not honored in some cases
    nav.navigateTo("2/2/0", CursorOrientation.Before);
    expect(nav.cursor.toString()).toEqual("BEFORE 2/2/0");
    expect(nav.tip.node).toEqual("f");

    const nav2 = new CursorNavigator(testDoc`<p> <s>A</s> <hyperlink url=a.com></hyperlink> <s>B</s> </p>`);
    nav2.navigateTo("0/2/0", CursorOrientation.Before);
    expect(nav2.tip.node).toEqual("B");
  });

  it("navigates to graphemes and changes orientation in some cases", () => {
    const nav = new CursorNavigator(CursorNavigatorTestUtils.testDocs.basicDoc);
    expect(nav.navigateTo("2/2/3", CursorOrientation.Before)).toBeTruthy();
    expect(nav.cursor.toString()).toEqual("AFTER 2/2/2");
    expect(nav.tip.node).toEqual("n");

    expect(nav.navigateTo("1/1/0", CursorOrientation.Before)).toBeTruthy();
    expect(nav.cursor.toString()).toEqual("AFTER 1/0/16");
    expect(nav.tip.node).toEqual("t");
  });

  it("navigates to empty insertion points", () => {
    const nav = new CursorNavigator(CursorNavigatorTestUtils.testDocs.basicDocWithEmptyInsertionPoints);
    expect(nav.navigateTo("0", CursorOrientation.On)).toBeTruthy();
    expect(nav.cursor.toString()).toEqual("ON 0");

    expect(nav.navigateTo("1/1", CursorOrientation.On)).toBeTruthy();
    expect(nav.cursor.toString()).toEqual("ON 1/1");

    expect(nav.navigateTo("2", CursorOrientation.On)).toBeTruthy();
    expect(nav.cursor.toString()).toEqual("ON 2");
  });

  it("navigates to between insertion points", () => {
    const nav = new CursorNavigator(CursorNavigatorTestUtils.testDocs.basicDocWithBetweenInsertionPoints);

    // expect(nav.navigateTo("0/0", CursorOrientation.Before)).toBeTruthy();
    // expect(nav.cursor.toString()).toEqual("BEFORE 0/0");
    // expect(nav.navigateTo("0/0", CursorOrientation.After)).toBeTruthy();
    // expect(nav.cursor.toString()).toEqual("AFTER 0/0");
    expect(nav.navigateTo("0/1", CursorOrientation.Before)).toBeTruthy();
    // Note the change because the navigator prefers after orientation to before orientation
    expect(nav.cursor.toString()).toEqual("AFTER 0/0");
    expect(nav.navigateTo("0/2", CursorOrientation.Before)).toBeTruthy();
    // Note the change because the navigator prefers after orientation to before orientation
    expect(nav.cursor.toString()).toEqual("AFTER 0/1");
    expect(nav.navigateTo("0/2", CursorOrientation.After)).toBeTruthy();
    expect(nav.cursor.toString()).toEqual("AFTER 0/2");
  });

  it("auto-corrects navigation in some cases", () => {
    const nav = new CursorNavigator(testDoc`<p> <s>ASD</s> <hyperlink url=a.com></hyperlink> </p>`);
    nav.navigateTo("0/1", CursorOrientation.Before);
    expect(nav.cursor.toString()).toEqual("AFTER 0/0/2");
  });
});
