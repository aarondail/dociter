import { CursorNavigator, CursorOrientation } from "../../src/traversal-rd4";
import { testDoc } from "../utils-rd4";

describe("navigateToLastDescendantCursorPosition", () => {
  it("should handle empty insertion points", () => {
    const nav = new CursorNavigator(testDoc`<p> <s></s></p>`);
    nav.navigateFreelyTo("0/0", CursorOrientation.After);
    nav.navigateToLastDescendantCursorPosition();
    expect(nav.cursor.toString()).toEqual("ON 0/0");
  });
});
