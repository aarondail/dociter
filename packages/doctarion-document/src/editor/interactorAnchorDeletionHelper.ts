import { NodeAssociatedData } from "../working-document";

import { Interactor, InteractorAnchorType } from "./interactor";

export interface InteractorAnchorEntry {
  readonly interactor: Interactor;
  readonly anchorType: InteractorAnchorType;
}

export class NodeIdToInteractorAnchorMap {
  private dictionary: { [nodeId: string]: InteractorAnchorEntry[] };

  public constructor(interactors: Interactor[]) {
    this.dictionary = {};
    for (const interactor of interactors) {
      if (this.dictionary[interactor.mainAnchor.nodeId] === undefined) {
        this.dictionary[interactor.mainAnchor.nodeId] = [];
      }
      this.dictionary[interactor.mainAnchor.nodeId].push({ interactor, anchorType: InteractorAnchorType.Main });

      if (interactor.selectionAnchor) {
        if (this.dictionary[interactor.selectionAnchor.nodeId] === undefined) {
          this.dictionary[interactor.selectionAnchor.nodeId] = [];
        }
        this.dictionary[interactor.selectionAnchor.nodeId].push({
          interactor,
          anchorType: InteractorAnchorType.SelectionAnchor,
        });
      }
    }
  }

  public getMatches(nodeId: NodeId): InteractorAnchorEntry[] | undefined {
    return this.dictionary[nodeId];
  }
}

export interface InteractorAnchorDeletionEntry extends InteractorAnchorEntry {
  readonly relativeGraphemeDeletionCount?: number;
}

class InteractorAnchorSet {
  // true => object anchor is pointing to was deleted
  // false => object anchor is pointing to was not deleted
  // number => count of graphemes to the RIGHT of the anchor was deleted
  private map?: Map<Interactor, [boolean | number, boolean | number]>;

  public add(interactor: Interactor, anchorType: InteractorAnchorType, graphemeRelated?: boolean): void {
    if (!this.map) {
      this.map = new Map();
    }

    if (!this.map.has(interactor)) {
      this.map.set(interactor, [false, false]);
    }

    if (graphemeRelated) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const currentCount = this.map.get(interactor)![anchorType === InteractorAnchorType.Main ? 0 : 1];
      if (currentCount === true) {
        // Whole object deletion (what true means here) overrides grapheme related stuff
      } else if (currentCount === false) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.map.get(interactor)![anchorType === InteractorAnchorType.Main ? 0 : 1] = 1;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.map.get(interactor)![anchorType === InteractorAnchorType.Main ? 0 : 1] = currentCount + 1;
      }
      return;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.map.get(interactor)![anchorType === InteractorAnchorType.Main ? 0 : 1] = true;
    }
  }

  public getEntries(): InteractorAnchorDeletionEntry[] {
    if (!this.map) {
      return [];
    }

    const result: InteractorAnchorDeletionEntry[] = [];
    for (const [interactor, anchorBoolArray] of this.map.entries()) {
      if (anchorBoolArray[0] === true) {
        result.push({ interactor, anchorType: InteractorAnchorType.Main });
      } else if (typeof anchorBoolArray[0] === "number") {
        result.push({
          interactor,
          anchorType: InteractorAnchorType.Main,
          relativeGraphemeDeletionCount: anchorBoolArray[0],
        });
      }

      if (anchorBoolArray[1] === true) {
        result.push({ interactor, anchorType: InteractorAnchorType.SelectionAnchor });
      } else if (typeof anchorBoolArray[1] === "number") {
        result.push({
          interactor,
          anchorType: InteractorAnchorType.SelectionAnchor,
          relativeGraphemeDeletionCount: anchorBoolArray[1],
        });
      }
    }
    return result;
  }

  public isEmpty(): boolean {
    return this.map === undefined;
  }
}

export class InteractorAnchorDeletionHelper {
  private markedInteractorAnchors: InteractorAnchorSet;
  private nodeIdToInteractorAnchorMap: NodeIdToInteractorAnchorMap;

  public constructor(interactors: Interactor[]) {
    this.markedInteractorAnchors = new InteractorAnchorSet();
    this.nodeIdToInteractorAnchorMap = new NodeIdToInteractorAnchorMap(interactors);
  }

  public getAnchors(): InteractorAnchorDeletionEntry[] {
    return this.markedInteractorAnchors.getEntries();
  }

  public hasAnchors(): boolean {
    return !this.markedInteractorAnchors.isEmpty();
  }

  public markAnchorsOnNode(nodeId: NodeId): void {
    const objectNodeMatches = this.nodeIdToInteractorAnchorMap.getMatches(nodeId);
    if (!objectNodeMatches) {
      return;
    }

    for (const match of objectNodeMatches) {
      this.markedInteractorAnchors.add(match.interactor, match.anchorType);
    }
  }

  public markAnchorsRelativeToGrapheme(nodeId: NodeId, graphemeIndex: number): void {
    const objectNodeMatches = this.nodeIdToInteractorAnchorMap.getMatches(nodeId);
    if (!objectNodeMatches) {
      return;
    }

    for (const match of objectNodeMatches) {
      const g = match.interactor.getAnchor(match.anchorType)?.graphemeIndex;
      if (g === undefined) {
        continue;
      }
      if (g === graphemeIndex) {
        this.markedInteractorAnchors.add(match.interactor, match.anchorType);
      } else if (g > graphemeIndex) {
        this.markedInteractorAnchors.add(match.interactor, match.anchorType, true);
      }
    }
  }
}
