import binarySearch from "binary-search";

import { TextStyleModifier, TextStyleStrip } from "../text-model-rd4";

interface Entry {
  style: TextStyleModifier;
  graphemeIndex: number;
}

// TODO this class is definitely not done AND needs tests
export class WorkingTextStyleStrip implements TextStyleStrip {
  private entries: Entry[];

  public constructor(styles: TextStyleModifier[], indices: number[]) {
    this.entries = [];

    for (let i = 0; i < styles.length; i++) {
      this.entries.push({ style: styles[i], graphemeIndex: indices[i] });
    }

    this.entries.sort((a, b) => b.graphemeIndex - a.graphemeIndex);

    // Eliminate any duplicates
    if (this.entries.length > 2) {
      let prior = this.entries[this.entries.length - 1];
      for (let j = this.entries.length - 2; j >= 0; j--) {
        const current = this.entries[j];
        if (current.graphemeIndex === prior.graphemeIndex) {
          // This mutates current.style
          mergeStyleModifiers(prior.style, current.style);
          // Delete prior
          this.entries.splice(j + 1, 1);
        }
        prior = current;
      }
    }
  }

  public get styles(): TextStyleModifier[] {
    return this.entries.map((e) => e.style);
  }
  public get indices(): number[] {
    return this.entries.map((e) => e.graphemeIndex);
  }

  public addStyle(style: TextStyleModifier, graphemeIndex: number): void {
    const r = this.searchForEntryAtOrBeforeGraphemeIndex(graphemeIndex);
    if (!r) {
      this.entries.push({ style, graphemeIndex });
      return;
    }
    const { entryIndex: i, exactMatch } = r;

    if (exactMatch) {
      mergeStyleModifiers(style, this.entries[i].style);
    } else {
      this.entries.splice(i - 1, 0, { style, graphemeIndex });
    }
  }

  public clear(): void {
    this.entries.splice(0, this.entries.length);
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
    for (let j = i; j < this.entries.length; j++) {
      const e = this.entries[j];
      if (e.graphemeIndex < graphemeIndex + count) {
        if (deletionStartIndex === undefined) {
          deletionStartIndex = j;
        }
        deletionEndIndex = j;
        if (modifiedStyle) {
          // Note this mutates e.style
          mergeStyleModifiers(modifiedStyle, e.style);
          modifiedStyle = e.style;
        } else {
          modifiedStyle = e.style;
        }
      } else {
        firstNonDeletionIndex = j;
        break;
      }
    }

    // Update index for all non-deleted entries right of the deleted ones
    if (firstNonDeletionIndex) {
      for (let k = firstNonDeletionIndex; k < this.entries.length; k++) {
        this.entries[k].graphemeIndex -= count;
      }
    }

    // If there were any to delete
    if (modifiedStyle && deletionStartIndex !== undefined) {
      // Should we merge styles onto the first non-deleted entry?
      if (firstNonDeletionIndex !== undefined && this.entries[firstNonDeletionIndex].graphemeIndex === graphemeIndex) {
        mergeStyleModifiers(modifiedStyle, this.entries[firstNonDeletionIndex].style);
        // Then delete
        this.entries.splice(deletionStartIndex, firstNonDeletionIndex - deletionStartIndex);
      } else {
        // In this case we fake keep the first entry (that we would otherwise
        // delete) and just update it
        this.entries[deletionStartIndex].graphemeIndex = graphemeIndex;
        this.entries[deletionStartIndex].style = modifiedStyle;

        if (deletionEndIndex && deletionEndIndex > deletionStartIndex) {
          this.entries.splice(deletionStartIndex + 1, deletionEndIndex - deletionStartIndex);
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

    for (let k = i; k < this.entries.length; k++) {
      this.entries[k].graphemeIndex += count;
    }
  }

  private binarySearchComparator = (entry: Entry, graphemeIndexAsNeedle: number): number => {
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
