/* eslint-disable @typescript-eslint/no-unsafe-return */
import { NodeNavigator } from "../../src";
import { LayoutRect, NodeLayoutProvider, NodeLayoutReporter } from "../../src/layout-reporting";
import { Node, Text } from "../../src/models";
import { doc, inlineText, paragraph } from "../utils";

const text = Text.fromString("Here is some text 👩‍👩‍👧‍👧");

const testDoc1 = doc(paragraph(inlineText(text)));

function makeRect(x: number, y: number, w: number, height: number): LayoutRect {
  return {
    left: x,
    top: y,
    width: w,
    height: height,
    bottom: y + height,
    right: x + w,
  };
}

const CHAR_WIDTH = 5;
const LINE_HEIGHT = 10;
const CHARS_PER_LINE = 5;
const OVERALL_WIDTH = CHAR_WIDTH * CHARS_PER_LINE;
const layouts = new Map();
layouts.set(testDoc1, makeRect(0, 0, OVERALL_WIDTH, 1000));
const testParagraph1 = testDoc1.children[0];
layouts.set(testParagraph1, makeRect(0, 0, OVERALL_WIDTH, LINE_HEIGHT * 4));
const testInline1 = testDoc1.children[0].children[0];
layouts.set(testInline1, makeRect(0, 0, OVERALL_WIDTH, LINE_HEIGHT * 4));

class LayoutProviderMock implements NodeLayoutProvider {
  public constructor(private node: Node) {}

  public getGraphemeLayout(startOffset?: number, endOffset?: number): LayoutRect[] | undefined {
    if (this.node !== testInline1) {
      return undefined;
    }
    if (startOffset !== endOffset) {
      throw new Error("Not implemented");
    }
    const line = Math.floor(((startOffset || 0) * CHAR_WIDTH) / OVERALL_WIDTH);
    const offset = (startOffset || 0) % CHARS_PER_LINE;
    return [makeRect(offset * CHAR_WIDTH, line * LINE_HEIGHT, CHAR_WIDTH, LINE_HEIGHT)];
  }

  public getLayout(): LayoutRect | undefined {
    return layouts.get(this.node);
  }
}

const providers = new Map();
providers.set(testDoc1, new LayoutProviderMock(testDoc1));
providers.set(testParagraph1, new LayoutProviderMock(testParagraph1));
providers.set(testInline1, new LayoutProviderMock(testInline1));

describe("doesLineWrapAfter & doesLineWrapBefore", () => {
  test("reports true/false appropriately", () => {
    const reporter = new NodeLayoutReporter((node) => providers.get(node));
    const nav = new NodeNavigator(testDoc1);
    nav.navigateToChild(0);
    nav.navigateToChild(0);
    nav.navigateToChild(0);

    for (let i = 0; i < text.length; i++) {
      expect(reporter.doesLineWrapBefore(nav)).toEqual(i === 0 ? false : i % CHARS_PER_LINE === 0);
      expect(reporter.doesLineWrapAfter(nav)).toEqual(i % CHARS_PER_LINE === 4);
      nav.navigateToNextSibling();
    }
  });
});
