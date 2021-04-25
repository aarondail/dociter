import { LayoutRect, Node } from "doctarion-document";

import { adjustRect, areGraphemeRectsOnSameLine, buildGraphemeToCodeUnitMap } from "./utils";

const EMPTY_NUMBER_SET: ReadonlySet<number> = new Set();

export interface DetailedLayoutForNodeContainingOnlyText {
  /**
   * These are indecies of graphemes in the containing node that are FOLLOWED
   * by a line break.
   */
  readonly graphemeLineBreaks: ReadonlySet<number> | undefined;
  /**
   * Rects that cover the entire node.
   */
  readonly layoutRects: LayoutRect[];
}

export class NodeLayoutProvider {
  public constructor(public element?: HTMLElement, public node?: Node) {}

  /**
   * This is for testing.
   */
  public getAllGraphemeLayoutRectsForNodeContainingOnlyText(): (LayoutRect | undefined)[] | undefined {
    if (!this.element || !this.node || !(Node.isInlineText(this.node) || Node.isInlineUrlLink(this.node))) {
      return undefined;
    }

    const graphemeCount = this.node.text.length;
    const codeUnitCount = this.element.textContent?.length || 0;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const c = this.element.firstChild!;
    const r = new Range();
    r.selectNodeContents(this.element);

    const graphemeToCodeUnitMap = buildGraphemeToCodeUnitMap(this.node.text);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const graphemeToRectMap: (LayoutRect | undefined)[] = new Array(graphemeCount);

    for (let gi = 0; gi < graphemeCount; gi++) {
      graphemeToRectMap[gi] = this.getCodeUnitLayout(
        c,
        r,
        graphemeToCodeUnitMap[gi],
        gi === graphemeCount - 1 ? codeUnitCount : graphemeToCodeUnitMap[gi + 1]
        // "gi: " + this.node.text[gi]
      );
    }

    return graphemeToRectMap;
  }

  // TODO consider reworking Inline to make it clear there are inlines that
  // contain text, and inlines that don't and no other nodes contain text other
  // than inlines.
  public getDetailedLayoutForNodeContainingOnlyText(): DetailedLayoutForNodeContainingOnlyText | undefined {
    // The reason I am checking for inline text and inline url links rather than
    // just `containsText` is that this logic won't work for a theoreticaly node
    // that contains text AND something else. Not sure we will have such a node,
    // but this fells safer.
    //
    // Also this algorithm won't work (or wont be guarentted to work?) if the
    // letters bounding rectangles vary wildly in height. This should be ok,
    // since this is a single HTMLElement and so all the characters should have
    // the same styling (as long as no crazy CSS is being used)
    if (!this.element || !this.node || !(Node.isInlineText(this.node) || Node.isInlineUrlLink(this.node))) {
      return undefined;
    }

    const layoutRects = this.getLayout();
    if (!layoutRects) {
      return undefined;
    }

    const graphemeCount = this.node.text.length;
    const codeUnitCount = this.element.textContent?.length || 0;
    if (graphemeCount <= 1 || codeUnitCount <= 1) {
      return {
        layoutRects,
        graphemeLineBreaks: EMPTY_NUMBER_SET,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const c = this.element.firstChild!;
    const r = new Range();
    r.selectNodeContents(this.element);

    const graphemeToCodeUnitMap = buildGraphemeToCodeUnitMap(this.node.text);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const graphemeToRectMap: (LayoutRect | undefined | null)[] = new Array(graphemeCount);

    const getRectForGrapheme = (i: number) => {
      let rect = graphemeToRectMap[i];
      if (rect !== undefined) {
        return rect;
      }
      rect =
        this.getCodeUnitLayout(
          c,
          r,
          graphemeToCodeUnitMap[i],
          i === graphemeCount - 1 ? codeUnitCount : graphemeToCodeUnitMap[i + 1]
        ) || null;
      graphemeToRectMap[i] = rect;
      return rect;
    };

    let leftIndex = 0;
    let leftRect = getRectForGrapheme(leftIndex);
    graphemeToRectMap[leftIndex] = leftRect;

    let rightIndex = graphemeCount - 1;
    const lineBreaks = new Set<number>();
    while (leftIndex < rightIndex) {
      // console.log("NLP::loop", leftIndex, rightIndex);

      // Advance left forward if it doesn't have a rect
      if (!leftRect) {
        // console.log("no left rect");
        leftIndex++;
        leftRect = getRectForGrapheme(leftIndex);
        continue;
      }

      let rightRect = getRectForGrapheme(rightIndex);

      let allRectsBetweenLeftAndRightAreNull = false;
      if (!rightRect) {
        // console.log("no right rect");
        const originalRightIndex = rightIndex;

        // Are there any rects between this and leftIndex?
        while (leftIndex < rightIndex - 1) {
          rightIndex--;
          rightRect = getRectForGrapheme(rightIndex);
          if (rightRect) {
            break;
          }
        }

        // If we adjusted the rightIndex position and landed on a rect
        if (rightRect) {
          // Loop back around and retry everything
          continue;
        }

        allRectsBetweenLeftAndRightAreNull = true;

        // If there were no rects beteween the leftIndex and the
        // originalRightIndex then we need to try to go to the right to find the
        // next non undefined rect now...
        rightIndex = originalRightIndex;

        while (rightIndex < graphemeCount) {
          rightIndex++;
          rightRect = getRectForGrapheme(rightIndex);
          if (rightRect) {
            break;
          }
        }

        // If there are no rects left we are done
        if (!rightRect) {
          break;
        }
      }

      // console.log(leftRect.top, rightRect.top);
      // There is a right rect, is it on the same line as the leftRect?
      const sameLine = areGraphemeRectsOnSameLine(leftRect, rightRect);

      if (leftIndex === rightIndex - 1 || allRectsBetweenLeftAndRightAreNull) {
        if (!sameLine) {
          // console.log("##### adding line break");
          // console.log( leftIndex, rightIndex, this.node.text[leftIndex], leftRect, this.node.text[rightIndex], rightRect);
          lineBreaks.add(rightIndex);
        }
        // Advance both below
      } else {
        if (sameLine) {
          // Advance both below
        } else {
          // Search between left and right
          rightIndex = Math.max(leftIndex + 1, Math.floor(leftIndex + (rightIndex - leftIndex) / 4));
          continue;
        }
      }

      // Advance both left and right here
      leftIndex = rightIndex;
      leftRect = rightRect;
      // const remaining = graphemeCount - leftIndex;
      rightIndex = graphemeCount - 1; // Math.min(Math.floor(remaining / 2) + leftIndex, graphemeCount - 1);
      // console.log("advanceing", leftIndex, rightIndex, leftIndex < rightIndex);
    }

    return {
      layoutRects,
      graphemeLineBreaks: lineBreaks,
    };
  }

  // public getGraphemeLayout(startOffset?: number, endOffset?: number): LayoutRect[] | undefined {
  //   if (!this.element || !this.node || !Node.containsText(this.node)) {
  //     return undefined;
  //   }

  //   // console.log("Get grapheme layout,", startOffset, endOffset);
  //   const r = new Range();
  //   r.selectNodeContents(this.element);

  //   const maxLen = (this.element.textContent?.length || 1) - 1;

  //   let start = 0;
  //   let end = maxLen;
  //   if (startOffset !== undefined) {
  //     for (let i = 0; i < startOffset; i++) {
  //       // Add the CODE UNITS for an individual grapheme to the start
  //       start += this.node.text[i].length;
  //     }
  //   }
  //   if (endOffset !== undefined) {
  //     end = start;
  //     for (let i = startOffset !== undefined ? startOffset : 0; i < endOffset; i++) {
  //       // Add the CODE UNITS for an individual grapheme to the start
  //       end += this.node.text[i].length;
  //     }
  //   }

  //   // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  //   const c = this.element.firstChild!;
  //   const results = [];
  //   for (let i = start; i <= end; i++) {
  //     // console.log(i);
  //     r.setStart(c, i);
  //     r.setEnd(c, i + 1);
  //     // Sometimes (with line wrapping, a code point will have multiple rects.
  //     // Using getBoundingClientRect inflates to cover the entire pair of lines)
  //     //
  //     // We use the second rect since that is probably the one we want...
  //     const rects = r.getClientRects();
  //     // console.log("DocumentNode::getGrapheme rect count = ", rects.length, rects);
  //     if (rects.length === 1) {
  //       results.push(this.adjustRect(rects[0]));
  //     } else if (rects.length === 2) {
  //       results.push(this.adjustRect(rects[1]));
  //     } else {
  //       throw new Error("Unexpected number of rects when getting a code point's layout.");
  //     }
  //   }

  //   // console.log("Get grapheme layout, res", results);
  //   return results;
  // }

  public getLayout(): LayoutRect[] | undefined {
    if (!this.element) {
      return undefined;
    }
    const result = [];
    const rects = this.element.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      result.push(adjustRect(rects[i]));
    }
    return result;
  }

  /**
   * This can return undefined sometimes when there is literally nothing
   * renderered for the code point (e.g. if it is a whitespace in a sequence of
   * whitespace, and all the whitespace is collapsed).
   */
  private getCodeUnitLayout(
    firstChild: ChildNode,
    range: Range,
    start: number,
    end: number,
    debug?: string
  ): LayoutRect | undefined {
    // console.log("getcodeUnitlayout", start, end);
    range.setStart(firstChild, start);
    range.setEnd(firstChild, end);

    const rects = range.getClientRects();
    if (rects.length === 0) {
      return undefined;
    } else if (rects.length === 1) {
      // console.warn("=== 1 rect", debug, rects);
      return adjustRect(rects[0]);
    } else if (rects.length === 2) {
      // console.warn("=== 2 rects", debug, rects);
      if (rects[0].width === 0) {
        return adjustRect(rects[1]);
      }
      return adjustRect(rects[1]);
    } else {
      console.warn("> 2 rects", debug, rects);
      // throw new Error("Unexpected number of rects when getting a code point's layout.");
      return adjustRect(rects[0]);
    }
  }
}
