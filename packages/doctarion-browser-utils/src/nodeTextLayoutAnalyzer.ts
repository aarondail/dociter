import { HorizontalAnchor, Side } from "doctarion-document";

import { CodeUnitLayoutProvider } from "./codeUnitLayoutProvder";
import { NodeGraphemeInfo, areRectsOnSameLine } from "./utils";

const EMPTY_NUMBER_SET: ReadonlySet<number> = new Set();

/**
 * These are indecies of graphemes in the containing node that are PRECEEDED
 * by a line break. In other words, these graphemes START lines.
 */
export type GraphemeLineWraps = ReadonlySet<number>;

/**
 * This is intended to do analysis at one point in time for a HTMLElement +
 * document Node (that contains text).
 *
 * It doesn't recompute any results so if the node changes (or page layout
 * changes) a new instance should be created.
 */
export class NodeTextLayoutAnalyzer {
  private cachedLineWraps?: GraphemeLineWraps;
  private codeUnitCount: number;
  private graphemeCount: number;
  private graphemeRects: (ClientRect | null | undefined)[];
  private graphemeToCodeUnitIndecies: number[];

  public constructor(private readonly codeUnitLayoutProvider: CodeUnitLayoutProvider, info: NodeGraphemeInfo) {
    this.codeUnitCount = info.codeUnitCount;
    this.graphemeCount = info.graphemeCount;
    this.graphemeToCodeUnitIndecies = info.graphemeToCodeUnitIndecies;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.graphemeRects = new Array(this.graphemeCount);
  }

  public findGraphemeIndexOnSameLineButAt(
    target: HorizontalAnchor,
    startIndex: number
  ): { index: number; side: Side } | undefined {
    const startingRect = this.getGraphemeRect(startIndex);
    if (!startingRect) {
      return undefined;
    }
    if (startingRect.left <= target && startingRect.right >= target) {
      return { index: startIndex, side: target <= startingRect.left + startingRect.width / 2 ? Side.Left : Side.Right };
    }

    // Reverse meaning going left
    const reverse = target < startingRect.left;

    const lineWraps = this.getAllGraphemeLineWraps();
    let searchEndIndex;
    if (lineWraps && lineWraps.size > 0) {
      let priorIndex = 0;
      for (const index of [...lineWraps].sort()) {
        if (startIndex < index) {
          searchEndIndex = reverse ? priorIndex : index - 1;
          break;
        }
        priorIndex = index;
      }
    } else {
      searchEndIndex = reverse ? 0 : this.graphemeCount - 1;
    }

    if (searchEndIndex === undefined) {
      return undefined;
    }

    if (reverse) {
      for (let i = startIndex - 1; i >= searchEndIndex; i--) {
        const rect = this.getGraphemeRect(i);
        if (rect && rect.left <= target && rect.right >= target) {
          return { index: i, side: target <= rect.left + rect.width / 2 ? Side.Left : Side.Right };
        }
      }
    } else {
      for (let i = startIndex + 1; i <= searchEndIndex; i++) {
        const rect = this.getGraphemeRect(i);
        if (rect && rect.left <= target && rect.right >= target) {
          return { index: i, side: target <= rect.left + rect.width / 2 ? Side.Left : Side.Right };
        }
      }
    }
    return undefined;
  }

  /**
   * This returns the index of the next grapheme that STARTS a new line.
   */
  public findNextLineWrap(startIndex: number): number | undefined {
    let leftIndex = startIndex;
    let leftRect = this.getGraphemeRect(leftIndex);

    let rightIndex = this.graphemeCount - 1;
    while (leftIndex < rightIndex) {
      // console.log("NLP::loop", leftIndex, rightIndex);

      // Advance left forward if it doesn't have a rect
      if (!leftRect) {
        // console.log("no left rect");
        leftIndex++;
        leftRect = this.getGraphemeRect(leftIndex);
        continue;
      }

      let rightRect = this.getGraphemeRect(rightIndex);

      let allRectsBetweenLeftAndRightAreNull = false;
      if (!rightRect) {
        // console.log("no right rect");
        const originalRightIndex = rightIndex;

        // Are there any rects between this and leftIndex?
        while (leftIndex < rightIndex - 1) {
          rightIndex--;
          rightRect = this.getGraphemeRect(rightIndex);
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

        while (rightIndex < this.graphemeCount) {
          rightIndex++;
          rightRect = this.getGraphemeRect(rightIndex);
          if (rightRect) {
            break;
          }
        }

        // If there are no rects left we are done
        if (!rightRect) {
          break;
        }
      }

      // console.log(leftRect.top, rightRect.top, "b", leftRect.bottom, rightRect.bottom);
      // There is a right rect, is it on the same line as the leftRect?
      const sameLine = areRectsOnSameLine(leftRect, rightRect);
      // console.log("sameLine = ", sameLine);

      if (leftIndex === rightIndex - 1 || allRectsBetweenLeftAndRightAreNull) {
        if (!sameLine) {
          return rightIndex;
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
      rightIndex = this.graphemeCount - 1; // Math.min(Math.floor(remaining / 2) + leftIndex, graphemeCount - 1);
      // console.log("advanceing", leftIndex, rightIndex, leftIndex < rightIndex);
    }
    return undefined;
  }

  public getAllGraphemeLineWraps(): GraphemeLineWraps | undefined {
    if (this.cachedLineWraps) {
      return this.cachedLineWraps;
    }
    if (this.graphemeCount <= 1 || this.codeUnitCount <= 1) {
      return EMPTY_NUMBER_SET;
    }

    let leftIndex = 0;
    const lineWraps = new Set<number>();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const index = this.findNextLineWrap(leftIndex);
      if (index === undefined) {
        break;
      }
      lineWraps.add(index);
      leftIndex = index;
    }
    this.cachedLineWraps = lineWraps;
    return lineWraps;
  }

  /**
   * This is for testing.
   */
  public getAllGraphemeRects(): (ClientRect | null)[] | undefined {
    const results = [];
    for (let gi = 0; gi < this.graphemeCount; gi++) {
      results.push(this.getGraphemeRect(gi));
    }
    return results;
  }

  public getGraphemeRect(index: number): ClientRect | null {
    if (this.graphemeRects[index] === undefined) {
      this.graphemeRects[index] =
        this.codeUnitLayoutProvider.getCodeUnitsLayout(
          this.graphemeToCodeUnitIndecies[index],
          index === this.graphemeCount - 1 ? this.codeUnitCount : this.graphemeToCodeUnitIndecies[index + 1]
        ) || null;
    }
    return this.graphemeRects[index] || null;
  }
}
