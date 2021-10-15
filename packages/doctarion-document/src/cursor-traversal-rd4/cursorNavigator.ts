import { Chain, ChainLink, NodeNavigator, Path, PathString } from "../basic-traversal-rd4";
import { Document, Node } from "../document-model-rd4";

import { Cursor, CursorOrientation } from "./cursor";
import { getNavigableCursorOrientationsAt } from "./getNavigableCursorOrientationsAt";

export interface ReadonlyCursorNavigator {
  readonly chain: Chain;
  readonly grandParent: ChainLink | undefined;
  readonly parent: ChainLink | undefined;
  readonly tip: ChainLink;
  readonly cursor: Cursor;

  clone(): CursorNavigator;
  toNodeNavigator(): NodeNavigator;
}

/**
 * This class is similar to NodeNavigator but instead of navigating
 * between the nodes of a document it navigates between the places where a
 * cursor could be placed.
 */
export class CursorNavigator implements ReadonlyCursorNavigator {
  private currentOrientation: CursorOrientation;
  // This nodeNavigator stores the current node the cursor is on
  private nodeNavigator: NodeNavigator;

  public constructor(
    public readonly document: Document // private readonly layoutReporter: NodeLayoutReporter | undefined
  ) {
    // The document is always at the root of the chain
    this.currentOrientation = CursorOrientation.On;
    this.nodeNavigator = new NodeNavigator(document);
  }

  public get chain(): Chain {
    return this.nodeNavigator.chain;
  }

  public get grandParent(): ChainLink | undefined {
    return this.nodeNavigator.grandParent;
  }

  public get parent(): ChainLink | undefined {
    return this.nodeNavigator.parent;
  }

  public get tip(): ChainLink {
    return this.nodeNavigator.tip;
  }

  public get cursor(): Cursor {
    return new Cursor(this.nodeNavigator.path, this.currentOrientation);
  }

  public changeCursorOrientationFreely(orientation: CursorOrientation): void {
    this.currentOrientation = orientation;
  }

  public clone(): CursorNavigator {
    const navigator = new CursorNavigator(this.document);
    navigator.currentOrientation = this.currentOrientation;
    navigator.nodeNavigator = this.nodeNavigator.clone();
    return navigator;
  }

  public navigateFreelyTo(cursor: Cursor): boolean;
  public navigateFreelyTo(path: PathString | Path, orientation?: CursorOrientation): boolean;
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  navigateFreelyTo(cursorOrPath: any, maybeOrientation?: CursorOrientation): boolean {
    if (typeof cursorOrPath === "string") {
      return this.navigateFreelyTo(Path.parse(cursorOrPath), maybeOrientation as any);
    }

    let path: Path;
    let orientation: CursorOrientation;
    if ((cursorOrPath as Path).parts?.length >= 0) {
      path = cursorOrPath as Path;
      orientation = maybeOrientation || CursorOrientation.On;
    } else {
      path = (cursorOrPath as Cursor).path;
      orientation = (cursorOrPath as Cursor).orientation;
    }

    const n = new NodeNavigator(this.document);
    if (!n.navigateTo(path)) {
      return false;
    }
    this.nodeNavigator = n;
    this.currentOrientation = orientation;
    return true;
  }

  public navigateFreelyToChild(index: number): boolean {
    if (this.nodeNavigator.navigateToChild(index)) {
      this.currentOrientation = CursorOrientation.On;
      return true;
    }
    return false;
  }

  public navigateFreelyToDocumentNode(): boolean {
    if (this.nodeNavigator.navigateToDocumentNode()) {
      this.currentOrientation = CursorOrientation.On;
      return true;
    }
    return false;
  }

  public navigateFreelyToNextSibling(): boolean {
    if (this.nodeNavigator.navigateToNextSibling()) {
      this.currentOrientation = CursorOrientation.On;
      return true;
    }
    return false;
  }

  public navigateFreelyToParent(): boolean {
    if (this.nodeNavigator.navigateToParent()) {
      this.currentOrientation = CursorOrientation.On;
      return true;
    }
    return false;
  }

  public navigateFreelyToPrecedingSibling(): boolean {
    if (this.nodeNavigator.navigateToPrecedingSibling()) {
      this.currentOrientation = CursorOrientation.On;
      return true;
    }
    return false;
  }

  /**
   * Note that when navigating to a grapheme with before orientation, the
   * navigator may choose to use an earlier point with after orientation.
   */
  public navigateTo(cursor: Cursor): boolean;
  public navigateTo(path: PathString | Path, orientation?: CursorOrientation): boolean;
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  navigateTo(cursorOrPath: any, maybeOrientation?: CursorOrientation): boolean {
    const temp = this.clone();
    if (!temp.navigateFreelyTo(cursorOrPath, maybeOrientation || CursorOrientation.On)) {
      return false;
    }

    this.nodeNavigator = temp.nodeNavigator;
    this.currentOrientation = temp.currentOrientation;

    if (this.navigateToNextCursorPosition()) {
      this.navigateToPrecedingCursorPosition();
    } else {
      const positions = getNavigableCursorOrientationsAt(this.nodeNavigator);
      if (this.currentOrientation === CursorOrientation.On && positions.on) {
        this.currentOrientation = CursorOrientation.On;
      } else if (this.currentOrientation === CursorOrientation.Before && positions.before) {
        this.currentOrientation = CursorOrientation.Before;
      } else if (this.currentOrientation === CursorOrientation.After && positions.after) {
        this.currentOrientation = CursorOrientation.After;
      } else if (positions.on) {
        this.currentOrientation = CursorOrientation.On;
      } else if (positions.before) {
        this.currentOrientation = CursorOrientation.Before;
      } else if (positions.after) {
        this.currentOrientation = CursorOrientation.After;
      } else {
        this.navigateToPrecedingCursorPosition();
      }
    }

    return true;
  }

  public navigateToFirstDescendantCursorPosition(): boolean {
    const ancestor = this.nodeNavigator.tip.node;
    // Is empty insertion point
    if (this.tip.node instanceof Node && this.tip.node.children?.length === 0) {
      this.currentOrientation = CursorOrientation.On;
      return true;
    }
    return this.complexNavigationHelper({
      init: (nav) => (nav.currentOrientation = CursorOrientation.Before),
      advance: (nav) => nav.navigateToNextCursorPosition(),
      abort: (nav) => !nav.nodeNavigator.chain.contains(ancestor),
      success: (nav) => nav.tip.node !== ancestor,
    });
  }

  public navigateToLastDescendantCursorPosition(): boolean {
    const ancestor = this.nodeNavigator.tip.node;
    // Is empty insertion point
    if (this.tip.node instanceof Node && this.tip.node.children?.length === 0) {
      this.currentOrientation = CursorOrientation.On;
      return true;
    }
    return this.complexNavigationHelper({
      init: (nav) => (nav.currentOrientation = CursorOrientation.After),
      advance: (nav) => nav.navigateToPrecedingCursorPosition(),
      abort: (nav) => !nav.nodeNavigator.chain.contains(ancestor),
      success: (nav) => nav.tip.node !== ancestor,
    });
  }

  /**
   * This method along with its counterparts navigateToPrecedingCursorPosition
   * are in some ways the core functionality of the navigator. For determining
   * where the cursor really goes, these two methods are responsible.
   */
  public navigateToNextCursorPosition(): boolean {
    const orientation = this.currentOrientation;
    let skipDescendants = false;

    // This block of code is responsible for changing the cursor orientation from
    // before or neutral to another orientation without changing the node that the
    // navigator is on
    if (orientation === CursorOrientation.Before) {
      const positions = getNavigableCursorOrientationsAt(this.nodeNavigator);
      if (positions.on) {
        this.currentOrientation = CursorOrientation.On;
        return true;
      } else if (positions.after && !(this.tip.node instanceof Node && (this.tip.node.children?.length || 0) > 0)) {
        this.currentOrientation = CursorOrientation.After;
        return true;
      }
    } else if (orientation === CursorOrientation.On) {
      const positions = getNavigableCursorOrientationsAt(this.nodeNavigator);
      if (positions.after) {
        this.currentOrientation = CursorOrientation.After;
        return true;
      }
    } else if (orientation === CursorOrientation.After) {
      if (this.nodeNavigator.nextSiblingNode === undefined) {
        // Check parents
        const parentNavigator = this.nodeNavigator.cloneWithoutTip();
        const parentPositions = getNavigableCursorOrientationsAt(parentNavigator);
        if (parentPositions.after) {
          this.nodeNavigator = parentNavigator;
          return true;
        }
      }
      // We set this to true because if the current node HAS children, e.g.
      // this is an InlineUrlLink w/ text then the navigateForwardsInDfs below
      // will move INTO the children instead of PAST this entire node.  This is
      // because the NodeNavigator just thinks we are on an InlineUrlLink node
      // in its DFS and the next step of the DFS is normally to dive into
      // any children.
      skipDescendants = true;
    }

    // This loop basically just navigates through the DFS until we find the next
    // node that has cursor positions.  If we find something with just an after
    // position AND it has children we skip that and instead dive into the
    // children.  That after position will eventually (as
    // navigateToNextCursorPosition is called) come up again and be handled in
    // the block above this loop.
    const backup = this.nodeNavigator.clone();
    while (this.nodeNavigator.navigateForwardsByDfs({ skipDescendants })) {
      const newPositions = getNavigableCursorOrientationsAt(this.nodeNavigator);
      if (newPositions.before) {
        this.currentOrientation = CursorOrientation.Before;
        return true;
      } else if (newPositions.on) {
        this.currentOrientation = CursorOrientation.On;
        return true;
      } else if (newPositions.after && !(this.tip.node instanceof Node && (this.tip.node.children?.length || 0) > 0)) {
        this.currentOrientation = CursorOrientation.After;
        return true;
      }
      skipDescendants = false;
    }

    this.nodeNavigator = backup;
    return false;
  }

  public navigateToNextSiblingLastDescendantCursorPosition(): boolean {
    const clone = this.clone();
    if (clone.nodeNavigator.navigateToNextSibling()) {
      if (clone.navigateToLastDescendantCursorPosition()) {
        this.currentOrientation = clone.currentOrientation;
        this.nodeNavigator = clone.nodeNavigator;
        return true;
      }
    }
    return false;
  }

  /**
   * This method along with its counterparts navigateToNextCursorPosition
   * are in some ways the core functionality of the navigator. For determining
   * where the cursor really goes, these two methods are responsible.
   */
  public navigateToPrecedingCursorPosition(): boolean {
    const orientation = this.currentOrientation;
    let skipDescendants = false;

    if (orientation === CursorOrientation.After) {
      const positions = getNavigableCursorOrientationsAt(this.nodeNavigator);
      if (positions.on) {
        this.currentOrientation = CursorOrientation.On;
        return true;
      } else if (positions.before && !(this.tip.node instanceof Node && (this.tip.node.children?.length || 0) > 0)) {
        this.currentOrientation = CursorOrientation.Before;
        return true;
      }
    } else if (orientation === CursorOrientation.On) {
      const positions = getNavigableCursorOrientationsAt(this.nodeNavigator);
      if (positions.before) {
        this.currentOrientation = CursorOrientation.Before;
        return true;
      }
    } else if (orientation === CursorOrientation.Before) {
      if (this.nodeNavigator.precedingSiblingNode === undefined) {
        // Check parents
        const parentNavigator = this.nodeNavigator.cloneWithoutTip();
        const parentPositions = getNavigableCursorOrientationsAt(parentNavigator);
        if (parentPositions.before) {
          this.nodeNavigator = parentNavigator;
          return true;
        }
      }
      skipDescendants = true;
    }

    const backup = this.nodeNavigator.clone();
    while (this.nodeNavigator.navigateBackwardsByDfs({ skipDescendants })) {
      const newPositions = getNavigableCursorOrientationsAt(this.nodeNavigator);
      if (newPositions.after) {
        this.currentOrientation = CursorOrientation.After;
        return true;
      } else if (newPositions.on) {
        this.currentOrientation = CursorOrientation.On;
        return true;
      } else if (newPositions.before && !(this.tip.node instanceof Node && (this.tip.node.children?.length || 0) > 0)) {
        this.currentOrientation = CursorOrientation.Before;
        return true;
      }
      skipDescendants = false;
    }

    this.nodeNavigator = backup;
    return false;
  }

  public navigateToPrecedingSiblingFirstDescendantCursorPosition(): boolean {
    const clone = this.clone();
    if (clone.nodeNavigator.navigateToPrecedingSibling()) {
      if (clone.navigateToFirstDescendantCursorPosition()) {
        this.currentOrientation = clone.currentOrientation;
        this.nodeNavigator = clone.nodeNavigator;
        return true;
      }
    }
    return false;
  }

  public navigateToRelativeSibling(offset: number, orientation: CursorOrientation): boolean {
    const clone = this.clone();
    if (clone.nodeNavigator.navigateToRelativeSibling(offset)) {
      clone.currentOrientation = orientation;

      if (clone.navigateToNextCursorPosition()) {
        clone.navigateToPrecedingCursorPosition();
      } else {
        const positions = getNavigableCursorOrientationsAt(clone.nodeNavigator);
        if (!positions.before && !positions.on && !positions.after) {
          clone.navigateToPrecedingCursorPosition();
        }
      }

      this.currentOrientation = clone.currentOrientation;
      this.nodeNavigator = clone.nodeNavigator;
    }
    return false;
  }

  public toNodeNavigator(): NodeNavigator {
    return this.nodeNavigator.clone();
  }

  private complexNavigationHelper(options: {
    init?: (nav: CursorNavigator) => void;
    advance: (nav: CursorNavigator) => boolean;
    abort?: (nav: CursorNavigator) => boolean;
    success: (nav: CursorNavigator) => boolean;
  }): boolean {
    const clone = this.clone();
    options.init?.(clone);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (options.advance(clone)) {
        if (options.abort?.(clone)) {
          return false;
        }
        if (options.success(clone)) {
          this.currentOrientation = clone.currentOrientation;
          this.nodeNavigator = clone.nodeNavigator;
          return true;
        }
      } else {
        return false;
      }
    }
  }
}
