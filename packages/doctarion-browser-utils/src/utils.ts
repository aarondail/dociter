import { LayoutRect, Text } from "doctarion-document";

/**
 * Make the rect relative to the document itself rather than the part of the
 * document that is scrolled into view currently.
 */
export function adjustRect(rect: ClientRect): LayoutRect {
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  return {
    top: rect.top + scrollTop,
    bottom: rect.bottom + scrollTop,
    left: rect.left + scrollLeft,
    right: rect.right + scrollLeft,
    height: rect.height,
    width: rect.width,
  };
}

/**
 * This takes two LayoutRects corresponding to code units from a single
 * element/node (that only contains text), and guesses if they are on the same
 * line or not.
 */
export function areGraphemeRectsOnSameLine(earlier: LayoutRect, later: LayoutRect): boolean {
  // Is later to the left of earlier
  if (earlier.left > later.left) {
    return false;
  }
  const r = earlier.bottom > later.top;
  // if (r) {
  //   debugger;
  // }
  return r;
}

export function buildGraphemeToCodeUnitMap(text: Text): number[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result: number[] = new Array(text.length);

  let offset = 0;
  for (let i = 0; i < text.length; i++) {
    result[i] = offset;
    // Add the CODE UNITS for an individual grapheme to the start
    offset += text[i].length;
  }
  return result;
}
