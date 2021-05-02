import { Text, TextContainingNode } from "doctarion-document";

export interface NodeGraphemeInfo {
  readonly codeUnitCount: number;
  readonly graphemeCount: number;
  readonly graphemeToCodeUnitIndecies: number[];
}

/**
 * Make the rect relative to the document itself rather than the part of the
 * document that is scrolled into view currently.
 */
export function adjustRect(rect: ClientRect): ClientRect {
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

// This effectivly says, in the algorithm below, that if two rects vertically
// overlap by up to 4 pixels, that still counts as a new line
const LINE_DETECTION_RESTRICTION_HALF = 2;

/**
 * This takes two LayoutRects corresponding to code units from a single
 * element/node (that only contains text), and guesses if they are on the same
 * line or not.
 */
export function areRectsOnSameLine(earlier: ClientRect, later: ClientRect): boolean {
  // Is later to the left of earlier
  if (earlier.left > later.left) {
    return false;
  }
  return earlier.bottom - LINE_DETECTION_RESTRICTION_HALF > later.top + LINE_DETECTION_RESTRICTION_HALF;
}

export function buildGraphemeToCodeUnitMap(text: Text): { map: number[]; codeUnitCount: number } {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result: number[] = new Array(text.length);

  let offset = 0;
  for (let i = 0; i < text.length; i++) {
    result[i] = offset;
    // Add the CODE UNITS for an individual grapheme to the start
    offset += text[i].length;
  }
  return { map: result, codeUnitCount: offset };
}

export function buildNodeGraphemeInfo(node: TextContainingNode): NodeGraphemeInfo {
  const { map, codeUnitCount } = buildGraphemeToCodeUnitMap(node.text);
  return { codeUnitCount, graphemeCount: node.text.length, graphemeToCodeUnitIndecies: map };
}

export function shallowEqual<A>(a: A[], b: A[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
