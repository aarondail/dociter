import { InlineText, Text } from "doctarion-document";

import { NodeLayoutProvider } from "../src";

describe("NodeLayoutProvider", () => {
  describe("one line with no wrapping", () => {
    const node = InlineText.new("I am a little pony");
    let el: HTMLElement;
    let p: NodeLayoutProvider;
    beforeEach(() => {
      el = document.createElement("p");
      el.style.cssText = "width: 200px; background-color: #999; font-size: 20px; font-family: Arial;";
      el.textContent = Text.toString(node.text);
      document.body.appendChild(el);
      p = new NodeLayoutProvider(el, node);
    });
    // console.log(electron);
    // console.log(electron.remote);
    // electron.remote.getCurrentWindow().show();

    // This is really just to make sure things get layed out correctly
    it("the element gets added and doesn't wrap", () => {
      expect(el.getClientRects().length).toEqual(1);
    });

    it("no line breaks are detected", () => {
      const layout = p.getDetailedLayoutForNodeContainingOnlyText();
      expect(layout).toBeDefined();
      expect(layout?.layoutRects.length).toBe(1);
      expect(layout?.graphemeLineBreaks?.size).toBe(0);
    });
  });
});
