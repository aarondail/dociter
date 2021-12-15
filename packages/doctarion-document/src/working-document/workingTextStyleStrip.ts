import binarySearch from "binary-search";
import lodash from "lodash";

import { Mutable } from "../shared-utils";
import { TextStyle, TextStyleModifier, TextStyleModifierAtGrapheme, TextStyleStrip } from "../text-model";

export interface TextStyleAtGrapheme {
  readonly graphemeIndex: number;
  readonly style: TextStyle;
}

export interface ReadonlyWorkingTextStyleStrip extends TextStyleStrip {
  readonly modifiers: readonly TextStyleModifierAtGrapheme[];
  readonly styles: readonly TextStyleAtGrapheme[];
  readonly graphemeCount: number;

  getStyleAt(graphemeIndex: number): TextStyle | undefined;
}

export class WorkingTextStyleStrip extends TextStyleStrip {
  // This is just a public readonly reference to this.actualEntries
  public readonly styles: readonly TextStyleAtGrapheme[];

  private readonly actualEntries: Mutable<TextStyleAtGrapheme>[];
  private cachedComputedModifiers: TextStyleModifierAtGrapheme[] | undefined;

  public constructor(modifiers: readonly TextStyleModifierAtGrapheme[], private actualGraphemeCount: number) {
    super();
    this.actualEntries = [];
    this.styles = this.actualEntries;

    const sortedOriginalModifiers = [...modifiers];
    sortedOriginalModifiers.sort((a, b) => b.graphemeIndex - a.graphemeIndex);

    const currentStyle: Mutable<TextStyle> = {};
    let lastEntry: Mutable<TextStyleAtGrapheme> | undefined;
    for (const { graphemeIndex, modifier } of sortedOriginalModifiers) {
      if (graphemeIndex >= actualGraphemeCount) {
        break;
      }
      if (lastEntry && lastEntry.graphemeIndex === graphemeIndex) {
        if (this.applyModifierToMutableStyle(modifier, currentStyle)) {
          lastEntry.style = { ...currentStyle };
        }
      } else {
        if (this.applyModifierToMutableStyle(modifier, currentStyle)) {
          lastEntry = { graphemeIndex, style: { ...currentStyle } };
          this.actualEntries.push(lastEntry);
        }
      }
    }
  }

  public get graphemeCount(): number {
    return this.actualGraphemeCount;
  }

  public get modifiers(): readonly TextStyleModifierAtGrapheme[] {
    if (this.cachedComputedModifiers) {
      return this.cachedComputedModifiers;
    }

    let priorStyle = {};
    const result: TextStyleModifierAtGrapheme[] = [];
    for (const { graphemeIndex, style } of this.actualEntries) {
      const modifier = this.deriveModifierFromStyles(priorStyle, style);
      if (modifier !== null) {
        result.push({ graphemeIndex, modifier });
        priorStyle = style;
      }
    }
    this.cachedComputedModifiers = result;
    return this.cachedComputedModifiers;
  }

  public clear(): void {
    this.cachedComputedModifiers = [];
    this.actualEntries.splice(0, this.actualEntries.length);
  }

  public clearRange(fromGraphemeIndex: number, toGraphemeIndex: number): void {
    this.cachedComputedModifiers = undefined;
    let entryRemovalStartIndex: number | undefined;
    let entryRemovalEndIndex: number | undefined;

    const startingEntryMatch = this.searchForEntryAtOrBeforeGraphemeIndex(fromGraphemeIndex);
    if (startingEntryMatch) {
      const startingEntry = this.actualEntries[startingEntryMatch.entryIndex];
      if (startingEntryMatch.exactMatch) {
        this.clearMutableStyle(startingEntry.style);
        entryRemovalStartIndex = startingEntryMatch.entryIndex + 1;
      } else {
        this.actualEntries.splice(startingEntryMatch.entryIndex + 1, 0, {
          graphemeIndex: fromGraphemeIndex,
          style: {},
        });
        entryRemovalStartIndex = startingEntryMatch.entryIndex + 2;
      }
    } else {
      entryRemovalStartIndex = 0;
    }

    if (toGraphemeIndex >= this.actualGraphemeCount - 1) {
      entryRemovalEndIndex = this.actualGraphemeCount;
    } else {
      const toEntryMatch = this.searchForEntryAtOrBeforeGraphemeIndex(toGraphemeIndex + 1);
      if (toEntryMatch) {
        if (toEntryMatch.exactMatch) {
          entryRemovalEndIndex = toEntryMatch.entryIndex - 1;
        } else {
          const toEntry = this.actualEntries[toEntryMatch.entryIndex];
          if (toEntry.graphemeIndex === fromGraphemeIndex) {
            // Do nothing I guess?
          } else {
            toEntry.graphemeIndex = toGraphemeIndex + 1;
            entryRemovalEndIndex = toEntryMatch.entryIndex;
          }
        }
      } else {
        // No entry at or after the end?
      }
    }

    // Delete intervening entries
    if (entryRemovalEndIndex) {
      if (entryRemovalStartIndex) {
        this.actualEntries.splice(entryRemovalStartIndex, entryRemovalEndIndex - entryRemovalStartIndex);
      } else {
        this.actualEntries.splice(0, entryRemovalEndIndex);
      }
    }
  }

  public getStyleAt(graphemeIndex: number): TextStyle | undefined {
    const index = this.searchForEntryAtOrBeforeGraphemeIndex(graphemeIndex)?.entryIndex;
    if (index !== undefined) {
      return this.actualEntries[index].style;
    }
    return undefined;
  }

  public joinAppend(strip: ReadonlyWorkingTextStyleStrip): void {
    this.cachedComputedModifiers = undefined;

    const trailingStyle: Mutable<TextStyle> = {
      ...(this.actualEntries.length > 0 ? this.actualEntries[this.actualEntries.length - 1].style : undefined),
    };

    // We need to insert a special reverse entry to reset any styles from this
    // strip so they don't carry over into the joined one
    const needSpecialReverseEntryInMiddle = !this.isEmptyStyle(trailingStyle) && strip.graphemeCount > 0;
    if (needSpecialReverseEntryInMiddle) {
      const modifierAtBeginningOfAppend = strip.styles.length > 0 ? strip.styles[0] : undefined;
      if (!modifierAtBeginningOfAppend || modifierAtBeginningOfAppend.graphemeIndex > 0) {
        this.actualEntries.push({ graphemeIndex: this.actualGraphemeCount, style: {} });
      }
    }

    for (const entry of strip.styles) {
      this.actualEntries.push({
        graphemeIndex: this.actualGraphemeCount + entry.graphemeIndex,
        style: { ...entry.style },
      });
    }

    this.actualGraphemeCount += strip.graphemeCount;
  }

  public joinPrepend(strip: ReadonlyWorkingTextStyleStrip): void {
    this.cachedComputedModifiers = undefined;

    const trailingStyle: Mutable<TextStyle> = {
      ...(strip.styles.length > 0 ? strip.styles[strip.styles.length - 1].style : undefined),
    };

    // We need to insert a special reverse entry to reset any styles from the
    // other strip so they don't carry over into the joined one
    const needSpecialReverseEntryInMiddle = !this.isEmptyStyle(trailingStyle) && strip.graphemeCount > 0;
    if (needSpecialReverseEntryInMiddle) {
      const firstModifier = this.actualEntries.length > 0 ? this.actualEntries[0] : undefined;
      if (firstModifier && firstModifier.graphemeIndex > 0) {
        this.actualEntries.unshift({ graphemeIndex: 0, style: {} });
      }
    }

    for (const entry of this.actualEntries) {
      entry.graphemeIndex += strip.graphemeCount;
    }

    for (const entry of lodash.reverse(strip.styles)) {
      this.actualEntries.unshift({ graphemeIndex: entry.graphemeIndex, style: { ...entry.style } });
    }

    this.actualGraphemeCount += strip.graphemeCount;
  }

  public splitAt(graphemeIndex: number): WorkingTextStyleStrip {
    this.cachedComputedModifiers = undefined;

    const r = this.searchForEntryAtOrBeforeGraphemeIndex(graphemeIndex);

    let splitEntryIndex = undefined;
    if (r) {
      const beforeOrAtEntry = this.actualEntries[r.entryIndex];
      if (!r.exactMatch) {
        // Insert a duplicate
        this.actualEntries.splice(r.entryIndex + 1, 0, { graphemeIndex, style: { ...beforeOrAtEntry.style } });
        splitEntryIndex = r.entryIndex + 1;
      }
    }

    // Collect styles before index
    const split = new WorkingTextStyleStrip([], this.actualGraphemeCount - graphemeIndex);
    if (splitEntryIndex !== undefined) {
      const modifierEntriesToMoveRight = this.actualEntries.splice(
        splitEntryIndex,
        this.actualEntries.length - splitEntryIndex
      );

      this.actualGraphemeCount -= split.actualGraphemeCount;

      (split as any).actualEntries = modifierEntriesToMoveRight;
      (split as any).styles = (split as any).actualEntries;

      for (const entry of split.actualEntries) {
        entry.graphemeIndex -= graphemeIndex;
      }
      return split;
    } else {
      this.actualGraphemeCount -= split.actualGraphemeCount;

      (split as any).actualEntries = [...this.actualEntries];
      (split as any).styles = (split as any).actualEntries;

      for (const entry of split.actualEntries) {
        entry.graphemeIndex -= graphemeIndex;
      }

      this.actualEntries.splice(0, this.actualEntries.length);
      return split;
    }
  }

  public styleRange(fromGraphemeIndex: number, toGraphemeIndex: number, modifier: TextStyleModifier): void {
    this.cachedComputedModifiers = undefined;

    if (fromGraphemeIndex >= this.actualGraphemeCount) {
      return;
    }

    let restyleEntryStartIndex = undefined;
    const r1 = this.searchForEntryAtOrBeforeGraphemeIndex(fromGraphemeIndex);

    if (r1) {
      const entry = this.actualEntries[r1.entryIndex];
      if (r1.exactMatch) {
        this.applyModifierToMutableStyle(modifier, entry.style);
        restyleEntryStartIndex = r1.entryIndex + 1;
      } else {
        const style = { ...entry.style };
        if (this.applyModifierToMutableStyle(modifier, style)) {
          this.actualEntries.splice(r1.entryIndex + 1, 0, { graphemeIndex: fromGraphemeIndex, style });
          restyleEntryStartIndex = r1.entryIndex + 2;
        } else {
          restyleEntryStartIndex = r1.entryIndex + 1;
        }
      }
    } else {
      // No entries before the given from index
      const style = {};
      if (this.applyModifierToMutableStyle(modifier, style)) {
        this.actualEntries.splice(0, 0, { graphemeIndex: fromGraphemeIndex, style });
        restyleEntryStartIndex = 1;
      } else {
        restyleEntryStartIndex = 0;
      }
    }

    // Restyle intervening nodes
    let needInsert = true;
    let lastEntryPriorStyle = undefined;
    for (let i = restyleEntryStartIndex; i < this.actualEntries.length; i++) {
      const entry = this.actualEntries[i];
      if (entry.graphemeIndex <= toGraphemeIndex) {
        lastEntryPriorStyle = { ...entry.style };
        this.applyModifierToMutableStyle(modifier, entry.style);
      } else if (entry.graphemeIndex === toGraphemeIndex + 1) {
        // style should be unchanged
        needInsert = false;
        break;
      } else {
        if (lastEntryPriorStyle) {
          this.actualEntries.splice(i, 0, { graphemeIndex: toGraphemeIndex + 1, style: lastEntryPriorStyle });
        }
        needInsert = false;
        break;
      }
    }

    // Append node in case we reached the end and never encountered an entry beyond the toGrapheme
    if (needInsert && toGraphemeIndex < this.actualGraphemeCount - 1) {
      this.actualEntries.push({ graphemeIndex: toGraphemeIndex + 1, style: {} });
    }
  }

  public updateDueToGraphemeDeletion(graphemeIndex: number, count: number): void {
    this.cachedComputedModifiers = undefined;
    this.clearRange(graphemeIndex, graphemeIndex + count - 1);
    this.actualGraphemeCount -= count;
    const r = this.searchForEntryAtOrAfterGraphemeIndex(graphemeIndex);
    if (r) {
      for (let i = r.entryIndex; i < this.actualEntries.length; i++) {
        this.actualEntries[i].graphemeIndex -= count;
        if (this.actualEntries[i].graphemeIndex >= this.actualGraphemeCount - 1) {
          this.actualEntries.splice(i, this.actualEntries.length - i);
          break;
        }
      }
    }
  }

  public updateDueToGraphemeInsertion(graphemeIndex: number, count: number): void {
    this.cachedComputedModifiers = undefined;

    const r = this.searchForEntryAtOrAfterGraphemeIndex(graphemeIndex);
    if (!r) {
      return;
    }
    const { entryIndex: i } = r;

    for (let k = i; k < this.actualEntries.length; k++) {
      this.actualEntries[k].graphemeIndex += count;
    }

    this.actualGraphemeCount += count;
  }

  /**
   * Returns true if the modifier had some effect on the style, false otherwise.
   */
  private applyModifierToMutableStyle(modifier: TextStyleModifier, style: Mutable<TextStyle>): boolean {
    let anyChanges = false;
    for (const propertyName of Object.keys(modifier)) {
      const styleAsAny = style as any;
      const modifierValue = (modifier as any)[propertyName];
      if (modifierValue === null) {
        if (styleAsAny[propertyName]) {
          delete styleAsAny[propertyName];
          anyChanges = true;
        }
      } else {
        if (styleAsAny[propertyName] !== modifierValue) {
          styleAsAny[propertyName] = modifierValue;
          anyChanges = true;
        }
      }
    }
    return anyChanges;
  }

  private binarySearchComparator = (entry: { graphemeIndex: number }, graphemeIndexAsNeedle: number): number => {
    return entry.graphemeIndex - graphemeIndexAsNeedle;
  };

  private clearMutableStyle(style: Mutable<TextStyle>): void {
    for (const key of Object.keys(style)) {
      delete (style as any)[key];
    }
  }

  private deriveModifierFromStyles(from: TextStyle, to: TextStyle): TextStyleModifier | null {
    const modifier: Mutable<TextStyleModifier> = {};
    let modifierIsUseful = false;

    for (const key of Object.keys(from)) {
      if ((to as any)[key] === undefined) {
        modifierIsUseful = true;
        (modifier as any)[key] = null;
      }
    }

    for (const key of Object.keys(to)) {
      if ((from as any)[key] !== (to as any)[key]) {
        modifierIsUseful = true;
        (modifier as any)[key] = (to as any)[key];
      }
    }

    if (modifierIsUseful) {
      return modifier;
    }
    return null;
  }

  private isEmptyStyle(style: TextStyle): boolean {
    return Object.keys(style).length === 0;
  }

  private searchForEntryAtOrAfterGraphemeIndex(
    graphemeIndex: number
  ): { entryIndex: number; exactMatch: boolean } | undefined {
    const i = binarySearch(this.actualEntries, graphemeIndex, this.binarySearchComparator);
    const i2 = i >= 0 ? i : (i + 1) * -1;
    if (i2 < this.actualEntries.length) {
      return { entryIndex: i2, exactMatch: i >= 0 };
    }
  }

  private searchForEntryAtOrBeforeGraphemeIndex(
    graphemeIndex: number
  ): { entryIndex: number; exactMatch: boolean } | undefined {
    const i = binarySearch(this.actualEntries, graphemeIndex, this.binarySearchComparator);
    const i2 = i >= 0 ? i : (i + 1) * -1 - 1;
    if (i2 < this.actualEntries.length && i2 >= 0) {
      return { entryIndex: i2, exactMatch: i >= 0 };
    }
  }
}
