import binarySearch from "binary-search";
import lodash from "lodash";

import { Mutable } from "../miscUtils";
import { TextStyle, TextStyleModifier, TextStyleStrip, TextStyleStripEntry } from "../text-model-rd4";

export class WorkingTextStyleStrip extends TextStyleStrip {
  private mutableEntries: Mutable<TextStyleStripEntry>[];

  public constructor(entries: readonly TextStyleStripEntry[]) {
    super(...entries);
    this.mutableEntries = lodash.cloneDeep(this.entries) as any;

    this.mutableEntries.sort((a, b) => b.graphemeIndex - a.graphemeIndex);

    // Eliminate any duplicates
    if (this.entries.length > 2) {
      let prior = this.entries[this.entries.length - 1];
      for (let j = this.entries.length - 2; j >= 0; j--) {
        const current = this.entries[j];
        if (current.graphemeIndex === prior.graphemeIndex) {
          // This mutates current.style
          applyStyleModifiers(prior.modifier, current.modifier);
          // Delete prior
          this.mutableEntries.splice(j + 1, 1);
        }
        prior = current;
      }
    }

    this.entries = this.mutableEntries;
  }

  public clear(): void {
    this.mutableEntries.splice(0, this.entries.length);
    this.entries = this.mutableEntries;
  }

  public getModifierAtExactly(graphemeIndex: number): TextStyleModifier | undefined {
    const r = this.searchForEntryAtOrBeforeGraphemeIndex(graphemeIndex);
    if (r && r.exactMatch) {
      return this.entries[r.entryIndex].modifier;
    }
    return undefined;
  }

  public resolveStyleAt(graphemeIndex: number): TextStyle {
    const result = {};

    for (const e of this.entries) {
      if (e.graphemeIndex > graphemeIndex) {
        break;
      }
      TextStyle.applyModifier(result, e.modifier);
    }

    return result;
  }

  public setModifier(graphemeIndex: number, modifier: TextStyleModifier): void {
    this.setModifierPrime(graphemeIndex, modifier, true);
  }

  public updateAndSplitAt(splitAtGraphemeIndex: number): WorkingTextStyleStrip {
    const r = this.searchForEntryAtOrAfterGraphemeIndex(splitAtGraphemeIndex);

    let splitBoundaryEntryIndex = 0;
    if (r) {
      ({ entryIndex: splitBoundaryEntryIndex } = r);
    }

    // Collect styles before index
    const styleAtSplitOnRightSide = this.resolveStyleAt(splitAtGraphemeIndex);
    const modifierEntriesToMoveRight = this.mutableEntries.splice(
      splitBoundaryEntryIndex,
      this.mutableEntries.length - splitBoundaryEntryIndex
    );
    this.entries = this.mutableEntries;

    const split = new WorkingTextStyleStrip([]);
    split.mutableEntries = modifierEntriesToMoveRight;
    split.entries = split.mutableEntries;
    for (const entry of split.mutableEntries) {
      entry.graphemeIndex -= splitAtGraphemeIndex;
    }

    const modifierAtVeryBeginningOfSplitRight = this.getModifierAtExactly(0);
    if (modifierAtVeryBeginningOfSplitRight) {
      for (const key of Object.keys(modifierAtVeryBeginningOfSplitRight)) {
        delete (styleAtSplitOnRightSide as any)[key];
      }
    }

    split.setModifierPrime(0, styleAtSplitOnRightSide, false);
    return split;
  }

  public updateDueToGraphemeDeletion(graphemeIndex: number, count: number): void {
    const r = this.searchForEntryAtOrAfterGraphemeIndex(graphemeIndex);
    if (!r) {
      return;
    }
    const { entryIndex: i } = r;

    let deletionStartIndex = undefined;
    let deletionEndIndex = undefined;
    let modifiedStyle: TextStyleModifier | undefined;
    let firstNonDeletionIndex = undefined;
    for (let j = i; j < this.mutableEntries.length; j++) {
      const e = this.mutableEntries[j];
      if (e.graphemeIndex < graphemeIndex + count) {
        if (deletionStartIndex === undefined) {
          deletionStartIndex = j;
        }
        deletionEndIndex = j;
        if (modifiedStyle) {
          // Note this mutates e.style
          applyStyleModifiers(modifiedStyle, e.modifier);
          modifiedStyle = e.modifier;
        } else {
          modifiedStyle = e.modifier;
        }
      } else {
        firstNonDeletionIndex = j;
        break;
      }
    }

    // Update index for all non-deleted entries right of the deleted ones
    if (firstNonDeletionIndex) {
      for (let k = firstNonDeletionIndex; k < this.mutableEntries.length; k++) {
        this.mutableEntries[k].graphemeIndex -= count;
      }
    }

    // If there were any to delete
    if (modifiedStyle && deletionStartIndex !== undefined) {
      // Should we merge styles onto the first non-deleted entry?
      if (
        firstNonDeletionIndex !== undefined &&
        this.mutableEntries[firstNonDeletionIndex].graphemeIndex === graphemeIndex
      ) {
        applyStyleModifiers(modifiedStyle, this.mutableEntries[firstNonDeletionIndex].modifier);
        // Then delete
        this.mutableEntries.splice(deletionStartIndex, firstNonDeletionIndex - deletionStartIndex);
        this.entries = this.mutableEntries;
      } else {
        // In this case we fake keep the first entry (that we would otherwise
        // delete) and just update it
        this.mutableEntries[deletionStartIndex].graphemeIndex = graphemeIndex;
        this.mutableEntries[deletionStartIndex].modifier = modifiedStyle;

        if (deletionEndIndex && deletionEndIndex > deletionStartIndex) {
          this.mutableEntries.splice(deletionStartIndex + 1, deletionEndIndex - deletionStartIndex);
          this.entries = this.mutableEntries;
        }
      }
    }
  }

  public updateDueToGraphemeInsertion(graphemeIndex: number, count: number): void {
    const r = this.searchForEntryAtOrAfterGraphemeIndex(graphemeIndex);
    if (!r) {
      return;
    }
    const { entryIndex: i } = r;

    for (let k = i; k < this.mutableEntries.length; k++) {
      this.mutableEntries[k].graphemeIndex += count;
    }
  }

  public updateForAppend(currentGraphemeCount: number, strip: TextStyleStrip): void {
    const styleAtFinalCurrentGrapheme = this.resolveStyleAt(currentGraphemeCount - 1);

    // Append entries (using setModifier since that will keep them sorted)
    for (const entry of strip.entries) {
      // Note this (importantly!) will clone the entries
      this.setModifierPrime(entry.graphemeIndex + currentGraphemeCount, entry.modifier, true);
    }

    const modifierAtBeginningOfAppend = this.getModifierAtExactly(currentGraphemeCount);
    if (modifierAtBeginningOfAppend) {
      for (const key of Object.keys(modifierAtBeginningOfAppend)) {
        delete (styleAtFinalCurrentGrapheme as any)[key];
      }
    }

    // Make the style we are going to apply undo the styling from the current (pre-append) strip
    for (const key of Object.keys(styleAtFinalCurrentGrapheme)) {
      (styleAtFinalCurrentGrapheme as any)[key] = null;
    }

    this.setModifier(currentGraphemeCount, styleAtFinalCurrentGrapheme);
  }

  public updateForPrepend(prependedGraphemeCount: number, strip: TextStyleStrip): void {
    if (prependedGraphemeCount === 0) {
      return;
    }

    const styleAtFinalCurrentGrapheme = this.getModifierAtExactly(0) || {};

    this.updateDueToGraphemeInsertion(0, prependedGraphemeCount);

    // Prepend entries (using setModifier since that will keep them sorted)
    for (const entry of strip.entries) {
      // Note this (importantly!) will clone the entries
      this.setModifierPrime(entry.graphemeIndex, entry.modifier, true);
    }

    const modifierAtEndOfPrepend = this.resolveStyleAt(prependedGraphemeCount - 1);
    for (const key of Object.keys(modifierAtEndOfPrepend)) {
      if (
        (styleAtFinalCurrentGrapheme as any)[key] !== undefined &&
        (styleAtFinalCurrentGrapheme as any)[key] !== null
      ) {
        continue;
      }
      (styleAtFinalCurrentGrapheme as any)[key] = null;
    }

    this.setModifier(prependedGraphemeCount, styleAtFinalCurrentGrapheme);
  }

  private binarySearchComparator = (entry: TextStyleStripEntry, graphemeIndexAsNeedle: number): number => {
    return entry.graphemeIndex - graphemeIndexAsNeedle;
  };

  private searchForEntryAtOrAfterGraphemeIndex(
    graphemeIndex: number
  ): { entryIndex: number; exactMatch: boolean } | undefined {
    const i = binarySearch(this.entries, graphemeIndex, this.binarySearchComparator);
    const i2 = i >= 0 ? i : (i + 1) * -1;
    if (i2 < this.entries.length) {
      return { entryIndex: i2, exactMatch: i >= 0 };
    }
  }

  private searchForEntryAtOrBeforeGraphemeIndex(
    graphemeIndex: number
  ): { entryIndex: number; exactMatch: boolean } | undefined {
    const i = binarySearch(this.entries, graphemeIndex, this.binarySearchComparator);
    const i2 = i >= 0 ? i : (i + 1) * -1 - 1;
    if (i2 < this.entries.length && i2 >= 0) {
      return { entryIndex: i2, exactMatch: i >= 0 };
    }
  }

  private setModifierPrime(graphemeIndex: number, modifier: TextStyleModifier, cloneNeeded: boolean): void {
    if (Object.keys(modifier).length === 0) {
      return;
    }

    const r = this.searchForEntryAtOrBeforeGraphemeIndex(graphemeIndex);
    if (!r) {
      this.mutableEntries.unshift({ modifier: cloneNeeded ? lodash.clone(modifier) : modifier, graphemeIndex });
      return;
    }
    const { entryIndex: i, exactMatch } = r;

    if (exactMatch) {
      applyStyleModifiers(modifier, this.mutableEntries[i].modifier);
    } else {
      this.mutableEntries.splice(i + 1, 0, {
        modifier: cloneNeeded ? lodash.clone(modifier) : modifier,
        graphemeIndex,
      });
      this.entries = this.mutableEntries;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ReadonlyWorkingTextStyleStrip extends TextStyleStrip {
  // Actually, as of right now there are no differences... maybe there won't be any at all?
}

function applyStyleModifiers(source: TextStyleModifier, destination: TextStyleModifier): void {
  for (const key of Object.keys(source)) {
    const left = (source as any)[key];
    const right = (destination as any)[key];
    if (right === undefined) {
      (destination as any)[key] = left;
    } else if (left === right) {
      continue;
    } else if (left === true && right === false) {
      delete (destination as any)[key];
    } else if (left === false && right === true) {
      continue;
    } else if (left === null) {
      delete (destination as any)[key];
    } else if (right === null) {
      continue;
    } else {
      // Leave the destination as is
      continue;
    }
  }
}
