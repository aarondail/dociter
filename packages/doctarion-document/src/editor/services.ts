/* eslint-disable @typescript-eslint/no-non-null-assertion */
import binarySearch from "binary-search";
import { FriendlyIdGenerator } from "doctarion-utils";
import { Draft, castDraft, original } from "immer";
import lodash from "lodash";

import { Chain, NodeNavigator, Path } from "../basic-traversal";
import { Cursor } from "../cursor";
import { NodeLayoutReporter } from "../layout-reporting";
import { SimpleComparison } from "../miscUtils";
import { Node, NodeUtils } from "../models";

import { EditorEvents } from "./events";
import {
  Interactor,
  InteractorId,
  InteractorStatus,
  OrderedInteractorEntry,
  OrderedInteractorEntryCursor,
} from "./interactor";
import { NodeId } from "./nodeId";
import { EditorState } from "./state";

// -----------------------------------------------------------------------------
// Editor Services provide functionality that support operations and clients of
// the Editor. They can have their own mutable state (albeit there is a
// limitation that it cannot participate in undo and redo), and they can affect
// and access the EditorState.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// First up, the Node Lookup service.
// -----------------------------------------------------------------------------

/**
 * Lookup nodes, and the chain to nodes, by their id.
 *
 * Note, even though graphemes are nodes they are not assigned ids and thus
 * this service never deals with them.
 */
export class EditorNodeLookupService {
  private editorState: EditorState;

  // Note the editorState can _and will_ be updated by the Editor
  public constructor(initialEditorState: EditorState, private readonly editorEvents: EditorEvents) {
    this.editorState = initialEditorState;
    this.editorEvents.updateDone.addListener(this.handleEditorUpdateDone);
  }

  public getChainTo(nodeId: NodeId): Chain | undefined {
    const idChain = this.getIdChain(nodeId);
    const nav = new NodeNavigator(this.editorState.document);
    if (idChain.length === 0) {
      return undefined;
    }
    if (idChain[0] !== NodeId.getId(this.editorState.document)) {
      return undefined;
    }
    // Now walk the chain and find the matching nodes
    for (const id of idChain.slice(1)) {
      const children = NodeUtils.getChildren(nav.tip.node);
      if (!children) {
        return undefined;
      }
      const index = children.findIndex((n: Node) => NodeId.getId(n) === id);
      if (index === -1) {
        return undefined;
      }
      nav.navigateToChild(index);
    }
    return nav.chain;
  }

  /**
   * This is not a constant time (or equivalent) operation, but it should be
   * pretty fast.
   */
  public getNode(nodeId: NodeId): Node | undefined {
    const chain = this.getChainTo(nodeId);
    if (chain) {
      const lastLink = lodash.last(chain.links);
      if (lastLink) {
        return lastLink.node;
      }
    }
    return undefined;
  }

  public getPathTo(nodeId: NodeId): Path | undefined {
    const chain = this.getChainTo(nodeId);
    if (chain) {
      return chain.path;
    }
    return undefined;
  }

  private getIdChain(nodeId: string) {
    const idChain = [];
    let currentId: string | undefined = nodeId;
    while (currentId) {
      idChain.push(currentId);
      currentId = this.editorState.nodeParentMap[currentId];
    }
    idChain.reverse();
    return idChain;
  }

  private handleEditorUpdateDone = (newState: EditorState) => {
    this.editorState = newState;
  };
}

// -----------------------------------------------------------------------------
// Second, the (very important) Node Tracking service
// -----------------------------------------------------------------------------

/**
 * The EditorNodeTrackingService is responsible for assigning unique ids to
 * nodes and maintaining the graph (aka nodeParentMap in the EditorState) of
 * the node (ids) that lets it lookup a node based on the id.
 *
 * This is intended to _only_ be used by `EditorOperation` functions.
 *
 * Note, even though graphemes are nodes they are not assigned ids and thus
 * this service never deals with them.
 */
export class EditorNodeTrackingService {
  private editorState: Draft<EditorState> | null;

  public constructor(private readonly idGenerator: FriendlyIdGenerator, private readonly editorEvents: EditorEvents) {
    this.editorState = null;
    this.editorEvents.updateStart.addListener(this.handleEditorUpdateStart);
    this.editorEvents.updateDone.addListener(this.handleEditorUpdateDone);
  }

  public notifyNodeMoved(node: Node, newParentId: NodeId): void {
    const id = NodeId.getId(node);
    if (id && this.editorState) {
      this.editorState.nodeParentMap[id] = newParentId;
    }
  }

  /**
   * When a new node is added to the document, this method must be called (the
   * exception being graphemes). This method assigns the node its id.
   */
  public register(node: Node, parent: Node | undefined): NodeId | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const nodeId = this.idGenerator.generateId((node as any).kind || "DOCUMENT");
    NodeId.assignId(node, nodeId);

    const parentId = parent && NodeId.getId(parent);
    if (parentId && this.editorState) {
      this.editorState.nodeParentMap[nodeId] = parentId;
    }

    return nodeId;
  }

  /**
   * When a node is removed from the document this must be called. If the node
   * is just moved to a new parent, the `notifyNodeMoved` method should be called.
   */
  public unregister(node: Node): void {
    const id = NodeId.getId(node);
    if (id && this.editorState) {
      delete this.editorState.nodeParentMap[id];
    }
  }

  private handleEditorUpdateDone = () => {
    this.editorState = null;
  };

  private handleEditorUpdateStart = (newState: Draft<EditorState>) => {
    this.editorState = newState;
  };
}

// -----------------------------------------------------------------------------
// Third, the complicated and very important EditorInteractorService.
// All updates to Interactors should be done with this service.
// -----------------------------------------------------------------------------

/**
 * This manages all interactors.
 *
 * This is intended to _only_ be used by `EditorOperation` functions.
 */
export class EditorInteractorService {
  private editorState: Draft<EditorState> | null;

  public constructor(private readonly editorEvents: EditorEvents) {
    this.editorState = null;
    this.editorEvents.updateStart.addListener(this.handleEditorUpdateStart);
    this.editorEvents.updateDone.addListener(this.handleEditorUpdateDone);
  }

  public add(newInteractor: Interactor): boolean {
    if (!this.editorState) {
      return false;
    }
    this.editorState.interactors[newInteractor.id] = castDraft(newInteractor);

    const newMainEntry = { id: newInteractor.id, cursor: OrderedInteractorEntryCursor.Main };
    const insertionPoint = binarySearch(this.editorState.orderedInteractors, newMainEntry, this.comparator);

    if (insertionPoint >= 0) {
      // This means that there was an exact match with another existing main
      // cursor... the only material thing that could be different is the
      // selection anchor. We don't really want to add a duplicate. Its a little
      // murky what is the best thing to do in the case of selections so we just
      // deal w/ non selctions here.
      if (!newInteractor.isSelection) {
        return false;
      }
    }

    this.editorState.orderedInteractors.splice(
      insertionPoint >= 0 ? insertionPoint : (insertionPoint + 1) * -1,
      0,
      newMainEntry
    );

    if (newInteractor.selectionAnchorCursor) {
      const newSelectionEntry = { id: newInteractor.id, cursor: OrderedInteractorEntryCursor.SelectionAnchor };
      const insertionPoint = binarySearch(this.editorState.orderedInteractors, newSelectionEntry, this.comparator);
      this.editorState.orderedInteractors.splice(
        insertionPoint >= 0 ? insertionPoint : (insertionPoint + 1) * -1,
        0,
        newSelectionEntry
      );
    }

    return true;
  }

  public delete(id: InteractorId): void {
    if (!this.editorState) {
      return;
    }
    const interactor = this.editorState.interactors[id];
    if (!interactor) {
      return;
    }

    const mainEntry = { id, cursor: OrderedInteractorEntryCursor.Main };
    const mainEntryIndex = binarySearch(this.editorState.orderedInteractors, mainEntry, this.comparator);
    if (mainEntryIndex >= 0) {
      this.editorState.orderedInteractors.splice(mainEntryIndex, 1);
    }

    if (interactor.selectionAnchorCursor) {
      const newSelectionEntry = { id, cursor: OrderedInteractorEntryCursor.SelectionAnchor };
      const selectionEntryIndex = binarySearch(this.editorState.orderedInteractors, newSelectionEntry, this.comparator);
      if (selectionEntryIndex >= 0) {
        this.editorState.orderedInteractors.splice(selectionEntryIndex, 1);
      }
    }

    delete this.editorState.interactors[id];
  }

  public *interactorCursorsAtOrAfter(cursor: Cursor): Generator<OrderedInteractorEntry> {
    if (!this.editorState) {
      return;
    }

    let startingIndex = binarySearch(this.editorState.orderedInteractors, cursor, this.findCursorComparator);

    if (startingIndex < 0) {
      startingIndex = startingIndex * -1;
    }

    for (let i = startingIndex; i < this.editorState.orderedInteractors.length; i++) {
      yield this.editorState.orderedInteractors[i];
    }
  }

  public notifyUpdated(id: InteractorId | InteractorId[]): void {
    if (!this.editorState) {
      return;
    }

    if (typeof id === "string") {
      this.notifyUpdatedCore(id);
    } else {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      id.forEach(this.notifyUpdatedCore);
    }

    // Then take care of status and cursor position changes by just doing the
    // simplest thing possible and resorting the ordered iterators.
    this.editorState.orderedInteractors.sort(this.comparator);

    this.dedupe();
  }

  private comparator = (a: OrderedInteractorEntry, b: OrderedInteractorEntry) => {
    if (!this.editorState) {
      return NaN;
    }
    const ai = this.editorState.interactors[a.id];
    const bi = this.editorState.interactors[b.id];

    const afc = a.cursor === OrderedInteractorEntryCursor.SelectionAnchor ? ai.selectionAnchorCursor : ai.mainCursor;
    const bfc = b.cursor === OrderedInteractorEntryCursor.SelectionAnchor ? bi.selectionAnchorCursor : bi.mainCursor;

    if (!afc || !bfc) {
      return NaN;
    }

    switch (afc.compareTo(bfc)) {
      case SimpleComparison.Before:
        return -1;
      case SimpleComparison.After:
        return 1;
      default:
        // To make things deterministic and to make it easy to do deduplication
        // (on the ordered interactors) we also consider the status and type of
        // cursor when doing ordering.
        if (ai.status !== bi.status) {
          // Put active cursors before inactive ones
          if (ai.status === InteractorStatus.Inactive) {
            return 1;
          }
          return -1;
        }
        if (a.cursor !== b.cursor) {
          // Put main cursors before selection anchor cursors
          if (a.cursor === OrderedInteractorEntryCursor.SelectionAnchor) {
            return 1;
          }
          return -1;
        }
        // Finally put main cursors that have a selection after main cursors that don't
        if (a.cursor === OrderedInteractorEntryCursor.Main) {
          if (ai.isSelection !== bi.isSelection) {
            if (ai.isSelection) {
              return 1;
            }
            return -1;
          }
        }
        return 0;
    }
  };

  /**
   * There definitely could be more situations in which we want to dedupe
   * interactors, but for right now we only dedupe interactors that ARENT a
   * selection AND have the same status AND their mainCursor is equal.
   *
   * This must be called after the orderedInteractors has been sorted.
   */
  private dedupe(): InteractorId[] | undefined {
    if (!this.editorState) {
      return;
    }

    // Dedupe
    let dupeIndecies: number[] | undefined;
    let dupeIds: InteractorId[] | undefined;
    for (let i = 0; i < this.editorState.orderedInteractors.length - 1; i++) {
      const a = this.editorState.orderedInteractors[i];
      const b = this.editorState.orderedInteractors[i + 1];
      // We don't care about deduping selections at this point since its unclear
      // what the best behavior is
      if (a.id === b.id || a.cursor === OrderedInteractorEntryCursor.SelectionAnchor) {
        continue;
      }
      if (this.editorState.interactors[b.id].isSelection) {
        continue;
      }
      if (this.comparator(a, b) === 0) {
        // OK in this case the two interactors are materially the same. The only
        // possible difference would be that the selection anchor is different
        // but we have ruled that out actually by checking `isSelection` above
        // here.
        if (!dupeIndecies) {
          dupeIndecies = [];
          dupeIds = [];
        }
        dupeIndecies.unshift(i + 1);
        dupeIds!.push(b.id);
      }
    }

    if (dupeIndecies) {
      // Note this is in reverse order!
      // Also note that because we ONLY dedupe interactors that are not
      // selections we only ever have one entry to delete from this array
      dupeIndecies.forEach((index) => this.editorState!.orderedInteractors.splice(index, 1));
      dupeIds?.forEach((id) => {
        delete this.editorState!.interactors[id];
        if (this.editorState!.focusedInteractorId === id) {
          this.editorState!.focusedInteractorId = undefined;
        }
      });
    }
    return dupeIds;
  }

  private findCursorComparator = (a: OrderedInteractorEntry, needle: Cursor) => {
    if (!this.editorState) {
      return NaN;
    }
    const ai = this.editorState.interactors[a.id];

    const afc = a.cursor === OrderedInteractorEntryCursor.SelectionAnchor ? ai.selectionAnchorCursor : ai.mainCursor;

    if (!afc) {
      return NaN;
    }

    switch (afc.compareTo(needle)) {
      case SimpleComparison.Before:
        return -1;
      case SimpleComparison.After:
        return 1;
      default:
        return 0;
    }
  };

  private handleEditorUpdateDone = () => {
    this.editorState = null;
  };

  private handleEditorUpdateStart = (newState: Draft<EditorState>) => {
    this.editorState = newState;
  };

  private notifyUpdatedCore = (id: InteractorId) => {
    const interactor = this.editorState!.interactors[id];
    if (!interactor) {
      return;
    }
    const oldInteractor = original(interactor);
    if (interactor === oldInteractor) {
      return;
    }

    // Take care of selectionAnchorCursor changes (if it was undefined or is now undefined)
    if (!oldInteractor?.selectionAnchorCursor && interactor.selectionAnchorCursor) {
      const newSelectionEntry = { id, cursor: OrderedInteractorEntryCursor.SelectionAnchor };
      const insertionPoint = binarySearch(this.editorState!.orderedInteractors, newSelectionEntry, this.comparator);
      this.editorState!.orderedInteractors.splice(
        insertionPoint >= 0 ? insertionPoint : (insertionPoint + 1) * -1,
        0,
        newSelectionEntry
      );
    } else if (oldInteractor?.selectionAnchorCursor && !interactor.selectionAnchorCursor) {
      const selectionEntryIndex = this.editorState!.orderedInteractors.findIndex(
        (entry) => entry.id === id && entry.cursor === OrderedInteractorEntryCursor.SelectionAnchor
      );
      if (selectionEntryIndex >= 0) {
        this.editorState!.orderedInteractors.splice(selectionEntryIndex, 1);
      }
    }
  };
}

// -----------------------------------------------------------------------------
// Finally the *Services types that group the services together
// -----------------------------------------------------------------------------

/**
 * These are all the services available to `EditorOperation` functions.
 */
export interface EditorOperationServices {
  readonly idGenerator: FriendlyIdGenerator;

  readonly lookup: EditorNodeLookupService;
  /**
   * The node tracking service is responsible for assigning node ids, and
   * looking up nodes by id.
   *
   * Note: graphemes don't get assigned unique ids and that for ids to be
   * assigned, this service has to be called. It doesn't automagically assign
   * ids to new nodes.
   */
  readonly tracking: EditorNodeTrackingService;
  /**
   * The layout service doesn't layout nodes, rather it reports layout
   * information related to nodes.
   */
  readonly layout?: NodeLayoutReporter;
  /**
   * The interactor service is responsible for all changes to interactors.
   */
  readonly interactors: EditorInteractorService;
}

/**
 * These are all the services available to Editor users (not operations).
 */
export type EditorServices = Pick<EditorOperationServices, "lookup" | "layout">;

/**
 * These are services that the Editor provides in all cases.
 */
export type EditorProvidedServices = Pick<
  EditorOperationServices,
  "tracking" | "lookup" | "idGenerator" | "interactors"
>;

/**
 * These are services that have to be provided to the Editor.
 */
export type EditorProvidableServices = Pick<EditorOperationServices, "layout">;
