import { Anchor, AnchorId } from "./anchor";
import { Interactor, InteractorAnchorType } from "./interactor";
import { NodeId } from "./nodeAssociatedData";
import { ReadonlyWorkingDocument } from "./workingDocument";

export interface MarkedAnchorEntry {
  readonly interactor?: Interactor;
  readonly interactorAnchorType?: InteractorAnchorType;
  readonly anchor: Anchor;
}

class NodeIdToMarkedAnchorMap {
  private dictionary: { [nodeId: string]: MarkedAnchorEntry[] };

  public constructor(document: ReadonlyWorkingDocument) {
    this.dictionary = {};
    for (const anchor of document.getAllAnchors()) {
      if (this.dictionary[anchor.nodeId] === undefined) {
        this.dictionary[anchor.nodeId] = [];
      }
      const interactor = anchor.relatedInteractorId ? document.getInteractor(anchor.relatedInteractorId) : undefined;
      const interactorAnchorType = interactor
        ? interactor.mainAnchor === anchor.id
          ? InteractorAnchorType.Main
          : interactor.selectionAnchor === anchor.id
          ? InteractorAnchorType.SelectionAnchor
          : undefined
        : undefined;

      this.dictionary[anchor.nodeId].push({
        anchor,
        interactor,
        interactorAnchorType,
      });
    }
  }

  public getMarkedAnchorsForNode(nodeId: NodeId): MarkedAnchorEntry[] | undefined {
    return this.dictionary[nodeId];
  }
}

export interface MarkedAnchorDueToNodeDeletionEntry extends MarkedAnchorEntry {
  readonly relativeGraphemeDeletionCount?: number;
}

class MarkedAnchorDueToNodeDeletionSet {
  // true => object anchor is pointing to was deleted
  // false => object anchor is pointing to was not deleted
  // number => count of graphemes to the RIGHT of the anchor was deleted
  private map?: Map<AnchorId, boolean | number>;

  public constructor(private readonly document: ReadonlyWorkingDocument) {}

  public add(anchorId: AnchorId, graphemeRelated?: boolean): void {
    if (!this.map) {
      this.map = new Map();
    }

    if (!this.map.has(anchorId)) {
      this.map.set(anchorId, false);
    }

    if (graphemeRelated) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const currentCount = this.map.get(anchorId)!;
      if (currentCount === true) {
        // Whole object deletion (what true means here) overrides grapheme related stuff
      } else if (currentCount === false) {
        this.map.set(anchorId, 1);
      } else {
        this.map.set(anchorId, currentCount + 1);
      }
      return;
    } else {
      this.map.set(anchorId, true);
    }
  }

  public getEntries(): MarkedAnchorDueToNodeDeletionEntry[] {
    if (!this.map) {
      return [];
    }

    const result: MarkedAnchorDueToNodeDeletionEntry[] = [];
    for (const [anchorId, boolOrNumber] of this.map.entries()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const anchor = this.document.getAnchor(anchorId)!;
      const interactor = anchor.relatedInteractorId
        ? this.document.getInteractor(anchor.relatedInteractorId)
        : undefined;
      const interactorAnchorType = interactor
        ? interactor.mainAnchor === anchor.id
          ? InteractorAnchorType.Main
          : interactor.selectionAnchor === anchor.id
          ? InteractorAnchorType.SelectionAnchor
          : undefined
        : undefined;

      if (boolOrNumber === true) {
        result.push({ interactor, interactorAnchorType, anchor });
      } else if (typeof boolOrNumber === "number") {
        result.push({ interactor, interactorAnchorType, anchor, relativeGraphemeDeletionCount: boolOrNumber });
      }
    }
    return result;
  }

  public isEmpty(): boolean {
    return this.map === undefined;
  }
}

export class NodeDeletionAnchorMarker {
  private markedAnchors: MarkedAnchorDueToNodeDeletionSet;
  private nodeIdToAnchorMap: NodeIdToMarkedAnchorMap;

  public constructor(document: ReadonlyWorkingDocument) {
    this.markedAnchors = new MarkedAnchorDueToNodeDeletionSet(document);
    this.nodeIdToAnchorMap = new NodeIdToMarkedAnchorMap(document);
  }

  public getMarkedAnchors(): MarkedAnchorDueToNodeDeletionEntry[] {
    return this.markedAnchors.getEntries();
  }

  public hasMarkedAnchors(): boolean {
    return !this.markedAnchors.isEmpty();
  }

  public markAnchorsDirectlyOnNode(nodeId: NodeId): void {
    const objectNodeMatches = this.nodeIdToAnchorMap.getMarkedAnchorsForNode(nodeId);
    if (!objectNodeMatches) {
      return;
    }

    for (const match of objectNodeMatches) {
      this.markedAnchors.add(match.anchor.id);
    }
  }

  public markAnchorsRelativeToGrapheme(nodeId: NodeId, graphemeIndex: number): void {
    const objectNodeMatches = this.nodeIdToAnchorMap.getMarkedAnchorsForNode(nodeId);
    if (!objectNodeMatches) {
      return;
    }

    for (const match of objectNodeMatches) {
      const g = match.anchor.graphemeIndex;
      if (g === undefined) {
        continue;
      }
      if (g === graphemeIndex) {
        this.markedAnchors.add(match.anchor.id);
      } else if (g > graphemeIndex) {
        this.markedAnchors.add(match.anchor.id, true);
      }
    }
  }
}
