import { DocumentNode, Node } from "../document-model-rd5";

import { Chain, ChainLink } from "./chain";
import { CursorOrientation, CursorPath } from "./cursorPath";
import {
  CursorOrientationClassification,
  getDetailedNavigableCursorOrientationsAt,
  getNavigableCursorOrientationsAt,
} from "./getNavigableCursorOrientationsUtils";
import { NodeNavigator } from "./nodeNavigator";
import { Path, PathString } from "./path";

export interface ReadonlyCursorNavigator<NodeClass extends Node = Node> {
  readonly chain: Chain<NodeClass>;
  readonly cursor: CursorPath;
  readonly grandParent: ChainLink<NodeClass> | undefined;
  readonly parent: ChainLink<NodeClass> | undefined;
  readonly tip: ChainLink<NodeClass>;
  readonly path: Path;

  clone(): CursorNavigator<NodeClass>;
  toNodeNavigator(): NodeNavigator<NodeClass>;
}

/**
 * This class is similar to NodeNavigator but instead of navigating
 * between the nodes of a document it navigates between the places where a
 * cursor could be placed.
 */
export class CursorNavigator<NodeClass extends Node = Node> implements ReadonlyCursorNavigator<NodeClass> {
  private currentOrientation: CursorOrientation;
  // This nodeNavigator stores the current node the cursor is on
  private nodeNavigator: NodeNavigator<NodeClass>;

  public constructor(
    public readonly document: DocumentNode & NodeClass // private readonly layoutReporter: NodeLayoutReporter | undefined
  ) {
    // The document is always at the root of the chain
    this.currentOrientation = CursorOrientation.On;
    this.nodeNavigator = new NodeNavigator<NodeClass>(document);
  }

  public get chain(): Chain<NodeClass> {
    return this.nodeNavigator.chain;
  }

  public get grandParent(): ChainLink<NodeClass> | undefined {
    return this.nodeNavigator.grandParent;
  }

  public get parent(): ChainLink<NodeClass> | undefined {
    return this.nodeNavigator.parent;
  }

  public get path(): Path {
    return this.nodeNavigator.path;
  }

  public get tip(): ChainLink<NodeClass> {
    return this.nodeNavigator.tip;
  }

  public get cursor(): CursorPath {
    return new CursorPath(this.nodeNavigator.path, this.currentOrientation);
  }

  public changeCursorOrientationFreely(orientation: CursorOrientation): void {
    this.currentOrientation = orientation;
  }

  public clone(): CursorNavigator<NodeClass> {
    const navigator = new CursorNavigator<NodeClass>(this.document);
    navigator.currentOrientation = this.currentOrientation;
    navigator.nodeNavigator = this.nodeNavigator.clone();
    return navigator;
  }

  public navigateFreelyTo(cursor: CursorPath): boolean;
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
      path = (cursorOrPath as CursorPath).path;
      orientation = (cursorOrPath as CursorPath).orientation;
    }

    const n = new NodeNavigator<NodeClass>(this.document);
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
  public navigateTo(cursor: CursorPath): boolean;
  public navigateTo(path: PathString | Path, orientation?: CursorOrientation): boolean;
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  navigateTo(cursorOrPath: any, maybeOrientation?: CursorOrientation): boolean {
    const temp = this.clone();
    if (!temp.navigateFreelyTo(cursorOrPath, maybeOrientation || CursorOrientation.On)) {
      return false;
    }

    this.nodeNavigator = temp.nodeNavigator;
    this.currentOrientation = temp.currentOrientation;

    const positions = getDetailedNavigableCursorOrientationsAt(this.nodeNavigator);

    if (positions[this.currentOrientation] === CursorOrientationClassification.Deemphasized) {
      if (this.currentOrientation === CursorOrientation.Before) {
        this.navigateToPrecedingCursorPosition();
      } else {
        this.navigateToNextCursorPosition();
      }
    } else if (!positions[this.currentOrientation]) {
      // Jiggle cursor so it finds an appropriate spot to land on
      this.navigateToNextCursorPosition();
      this.navigateToPrecedingCursorPosition();
    }

    return true;
  }

  public navigateToFirstDescendantCursorPosition(): boolean {
    const ancestor = this.nodeNavigator.tip.node;
    // Is empty insertion point
    if (this.tip.node instanceof Node && this.tip.node.children.length === 0) {
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
    if (this.tip.node instanceof Node && this.tip.node.children.length === 0) {
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
      if (positions.ON) {
        this.currentOrientation = CursorOrientation.On;
        return true;
      } else if (positions.AFTER && !(this.tip.node instanceof Node && (this.tip.node.children.length || 0) > 0)) {
        this.currentOrientation = CursorOrientation.After;
        return true;
      }
    } else if (orientation === CursorOrientation.On) {
      const positions = getNavigableCursorOrientationsAt(this.nodeNavigator);
      if (positions.AFTER) {
        this.currentOrientation = CursorOrientation.After;
        return true;
      }
    } else if (orientation === CursorOrientation.After) {
      if (this.nodeNavigator.nextSiblingNode === undefined) {
        // Check parents
        const parentNavigator = this.nodeNavigator.cloneWithoutTip();
        const parentPositions = getNavigableCursorOrientationsAt(parentNavigator);
        if (parentPositions.AFTER) {
          this.nodeNavigator = parentNavigator;
          return true;
        }
      }
      // We set this to true because if the current node HAS children, e.g.
      // this is an Hyperlink w/ text then the navigateForwardsInDfs below
      // will move INTO the children instead of PAST this entire node.  This is
      // because the NodeNavigator just thinks we are on an Hyperlink node
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
      if (newPositions.BEFORE) {
        this.currentOrientation = CursorOrientation.Before;
        return true;
      } else if (newPositions.ON) {
        this.currentOrientation = CursorOrientation.On;
        return true;
      } else if (newPositions.AFTER && !(this.tip.node instanceof Node && (this.tip.node.children.length || 0) > 0)) {
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
      if (positions.ON) {
        this.currentOrientation = CursorOrientation.On;
        return true;
      } else if (positions.BEFORE && !(this.tip.node instanceof Node && (this.tip.node.children.length || 0) > 0)) {
        this.currentOrientation = CursorOrientation.Before;
        return true;
      }
    } else if (orientation === CursorOrientation.On) {
      const positions = getNavigableCursorOrientationsAt(this.nodeNavigator);
      if (positions.BEFORE) {
        this.currentOrientation = CursorOrientation.Before;
        return true;
      }
    } else if (orientation === CursorOrientation.Before) {
      if (this.nodeNavigator.precedingSiblingNode === undefined) {
        // Check parents
        const parentNavigator = this.nodeNavigator.cloneWithoutTip();
        const parentPositions = getNavigableCursorOrientationsAt(parentNavigator);
        if (parentPositions.BEFORE) {
          this.nodeNavigator = parentNavigator;
          return true;
        }
      }
      skipDescendants = true;
    }

    const backup = this.nodeNavigator.clone();
    while (this.nodeNavigator.navigateBackwardsByDfs({ skipDescendants })) {
      const newPositions = getNavigableCursorOrientationsAt(this.nodeNavigator);
      if (newPositions.AFTER) {
        this.currentOrientation = CursorOrientation.After;
        return true;
      } else if (newPositions.ON) {
        this.currentOrientation = CursorOrientation.On;
        return true;
      } else if (newPositions.BEFORE && !(this.tip.node instanceof Node && (this.tip.node.children.length || 0) > 0)) {
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
        if (!positions.BEFORE && !positions.ON && !positions.AFTER) {
          clone.navigateToPrecedingCursorPosition();
        }
      }

      this.currentOrientation = clone.currentOrientation;
      this.nodeNavigator = clone.nodeNavigator;
    }
    return false;
  }

  public toNodeNavigator(): NodeNavigator<NodeClass> {
    return this.nodeNavigator.clone();
  }

  private complexNavigationHelper(options: {
    init?: (nav: CursorNavigator<NodeClass>) => void;
    advance: (nav: CursorNavigator<NodeClass>) => boolean;
    abort?: (nav: CursorNavigator<NodeClass>) => boolean;
    success: (nav: CursorNavigator<NodeClass>) => boolean;
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
