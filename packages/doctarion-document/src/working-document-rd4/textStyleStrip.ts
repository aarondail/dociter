import binarySearch from "binary-search";

import { Mutable } from "../miscUtils";
import { TextStyle, TextStyleModifier, TextStyleStrip, TextStyleStripEntry } from "../text-model-rd4";

// TODO this class is definitely not done AND needs tests
export class WorkingTextStyleStrip extends TextStyleStrip {
  private mutableEntries: Mutable<TextStyleStripEntry>[];

  public constructor(entries: readonly TextStyleStripEntry[]) {
    super(...entries);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    this.mutableEntries = this.entries as any;

    this.mutableEntries.sort((a, b) => b.graphemeIndex - a.graphemeIndex);

    // Eliminate any duplicates
    if (this.entries.length > 2) {
      let prior = this.entries[this.entries.length - 1];
      for (let j = this.entries.length - 2; j >= 0; j--) {
        const current = this.entries[j];
        if (current.graphemeIndex === prior.graphemeIndex) {
          // This mutates current.style
          mergeStyleModifiers(prior.modifier, current.modifier);
          // Delete prior
          this.mutableEntries.splice(j + 1, 1);
        }
        prior = current;
      }
    }
  }

  public clear(): void {
    this.mutableEntries.splice(0, this.entries.length);
  }

  public getModifierAt(graphemeIndex: number): TextStyleModifier | undefined {
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
    const r = this.searchForEntryAtOrBeforeGraphemeIndex(graphemeIndex);
    if (!r) {
      this.mutableEntries.push({ modifier, graphemeIndex });
      return;
    }
    const { entryIndex: i, exactMatch } = r;

    if (exactMatch) {
      mergeStyleModifiers(modifier, this.mutableEntries[i].modifier);
    } else {
      this.mutableEntries.splice(i - 1, 0, { modifier, graphemeIndex });
    }
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
          mergeStyleModifiers(modifiedStyle, e.modifier);
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
        mergeStyleModifiers(modifiedStyle, this.mutableEntries[firstNonDeletionIndex].modifier);
        // Then delete
        this.mutableEntries.splice(deletionStartIndex, firstNonDeletionIndex - deletionStartIndex);
      } else {
        // In this case we fake keep the first entry (that we would otherwise
        // delete) and just update it
        this.mutableEntries[deletionStartIndex].graphemeIndex = graphemeIndex;
        this.mutableEntries[deletionStartIndex].modifier = modifiedStyle;

        if (deletionEndIndex && deletionEndIndex > deletionStartIndex) {
          this.mutableEntries.splice(deletionStartIndex + 1, deletionEndIndex - deletionStartIndex);
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
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ReadonlyWorkingTextStyleStrip extends TextStyleStrip {
  // Actually, as of right now there are no differences... maybe there won't be any at all?
}

function mergeStyleModifiers(source: TextStyleModifier, destination: TextStyleModifier): void {
  for (const key of Object.keys(source)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const left = (source as any)[key];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const right = (destination as any)[key];
    if (right === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      (destination as any)[key] = left;
    } else if (left === right) {
      continue;
    } else if (left === true && right === false) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      delete (destination as any)[key];
    } else if (left === false && right === true) {
      continue;
    } else if (left === null) {
      // This is like "popping" the style, but here the right overrides it with something new
      continue;
    } else if (right === null) {
      // This is like "popping" the style
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      delete (destination as any)[key];
    } else {
      // Leave the destination as is
      continue;
    }
  }
}