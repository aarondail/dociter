import { Chain, ChainLink, NodeNavigator, Path, PathString } from "../basic-traversal";
import { NodeLayoutReporter } from "../layout-reporting";
import { Document, NodeUtils } from "../models";

import { Cursor, CursorOrientation } from "./cursor";
import { PositionClassification } from "./positions";

/**
 * This class is similar to NodeNavigator but intead of navigating
 * between the nodes of a document it navigates between the places where a
 * cursor could be placed.
 *
 * To make the behavior of things like navigation more deterministic we prefer
 * some cursor positions to others even when they are equivalent. Specifically
 * we bias towards positions after nodes and we prefer to those that relate to
 * a grapheme vs not realted to one.
 */
export class CursorNavigator {
  private currentOrientation: CursorOrientation;
  // This nodeNavigator stores the current node the cursor is on
  private nodeNavigator: NodeNavigator;

  public constructor(public readonly document: Document, private readonly layoutReporter?: NodeLayoutReporter) {
    // The document is always at the root of the chain
    this.currentOrientation = CursorOrientation.On;
    this.nodeNavigator = new NodeNavigator(document);
  }

  public get chain(): Chain {
    return this.nodeNavigator.chain;
  }

  public get tip(): ChainLink {
    return this.nodeNavigator.tip;
  }

  public get cursor(): Cursor {
    return new Cursor(this.nodeNavigator.path, this.currentOrientation);
  }

  public classifyCurrentPosition(): PositionClassification {
    return PositionClassification.classify(this.nodeNavigator);
  }

  public clone(): CursorNavigator {
    const navigator = new CursorNavigator(this.document, this.layoutReporter);
    navigator.currentOrientation = this.currentOrientation;
    navigator.nodeNavigator = this.nodeNavigator.clone();
    return navigator;
  }

  /**
   * Note that when navigating to a grapheme with before orientation, the
   * navigator may choose to use an earlier point with after orientation.
   */
  public navigateTo(cursor: Cursor): boolean;
  public navigateTo(path: PathString | Path, orientation?: CursorOrientation): boolean;
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
  public navigateTo(cursorOrPath: any, maybeOrientation?: CursorOrientation): boolean {
    const temp = this.clone();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!temp.navigateToUnchecked(cursorOrPath, maybeOrientation || CursorOrientation.On)) {
      return false;
    }

    this.nodeNavigator = temp.nodeNavigator;
    this.currentOrientation = temp.currentOrientation;

    if (this.navigateToNextCursorPosition()) {
      this.navigateToPrecedingCursorPosition();
    } else {
      const positions = PositionClassification.getValidCursorOrientationsAt(this.nodeNavigator, this.layoutReporter);
      if (!positions.before && !positions.on && !positions.after) {
        this.navigateToPrecedingCursorPosition();
      }
    }

    return true;
  }

  public navigateToFirstDescendantCursorPosition(): boolean {
    const ancestor = this.nodeNavigator.tip.node;
    if (PositionClassification.isEmptyInsertionPoint(this.nodeNavigator.tip.node)) {
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
    if (PositionClassification.isEmptyInsertionPoint(this.nodeNavigator.tip.node)) {
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
   * This method along with its counterparts navigateToPreceedingCursorPosition
   * are in some ways the core functionality of the navigator. For determinging
   * where the cursor really goes, these two methods are responsible.
   */
  public navigateToNextCursorPosition(): boolean {
    const orientation = this.currentOrientation;
    let skipDescendants = false;

    // This block of code is responsible for changing the cursor orientation from
    // before or neutral to another orientation without changing the node that the
    // navigator is on
    if (orientation === CursorOrientation.Before) {
      const positions = PositionClassification.getValidCursorOrientationsAt(this.nodeNavigator, this.layoutReporter);
      if (positions.on) {
        this.currentOrientation = CursorOrientation.On;
        return true;
      } else if (positions.after && !NodeUtils.hasSomeChildren(this.nodeNavigator.tip.node)) {
        this.currentOrientation = CursorOrientation.After;
        return true;
      }
    } else if (orientation === CursorOrientation.On) {
      const positions = PositionClassification.getValidCursorOrientationsAt(this.nodeNavigator, this.layoutReporter);
      if (positions.after) {
        this.currentOrientation = CursorOrientation.After;
        return true;
      }
    } else if (orientation === CursorOrientation.After) {
      if (this.nodeNavigator.nextSiblingNode === undefined) {
        // Check parents
        const parentNavigator = this.nodeNavigator.cloneWithoutTip();
        const parentPositions = PositionClassification.getValidCursorOrientationsAt(
          parentNavigator,
          this.layoutReporter
        );
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
    while (this.nodeNavigator.navigateForwardsInDfs({ skipDescendants })) {
      const newPositions = PositionClassification.getValidCursorOrientationsAt(this.nodeNavigator, this.layoutReporter);
      if (newPositions.before) {
        this.currentOrientation = CursorOrientation.Before;
        return true;
      } else if (newPositions.on) {
        this.currentOrientation = CursorOrientation.On;
        return true;
      } else if (newPositions.after && !NodeUtils.hasSomeChildren(this.nodeNavigator.tip.node)) {
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

  public navigateToNextSiblingUnchecked(): boolean {
    if (this.nodeNavigator.navigateToNextSibling()) {
      this.currentOrientation = CursorOrientation.Before;
      return true;
    }
    return false;
  }

  public navigateToParentUnchecked(): boolean {
    if (this.nodeNavigator.navigateToParent()) {
      this.currentOrientation = CursorOrientation.On;
      return true;
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
      const positions = PositionClassification.getValidCursorOrientationsAt(this.nodeNavigator, this.layoutReporter);
      if (positions.on) {
        this.currentOrientation = CursorOrientation.On;
        return true;
      } else if (positions.before && !NodeUtils.hasSomeChildren(this.nodeNavigator.tip.node)) {
        this.currentOrientation = CursorOrientation.Before;
        return true;
      }
    } else if (orientation === CursorOrientation.On) {
      const positions = PositionClassification.getValidCursorOrientationsAt(this.nodeNavigator, this.layoutReporter);
      if (positions.before) {
        this.currentOrientation = CursorOrientation.Before;
        return true;
      }
    } else if (orientation === CursorOrientation.Before) {
      if (this.nodeNavigator.precedingSiblingNode === undefined) {
        // Check parents
        const parentNavigator = this.nodeNavigator.cloneWithoutTip();
        const parentPositions = PositionClassification.getValidCursorOrientationsAt(
          parentNavigator,
          this.layoutReporter
        );
        if (parentPositions.before) {
          this.nodeNavigator = parentNavigator;
          return true;
        }
      }
      skipDescendants = true;
    }

    const backup = this.nodeNavigator.clone();
    while (this.nodeNavigator.navigateBackwardsInDfs({ skipDescendants })) {
      const newPositions = PositionClassification.getValidCursorOrientationsAt(this.nodeNavigator, this.layoutReporter);
      if (newPositions.after) {
        this.currentOrientation = CursorOrientation.After;
        return true;
      } else if (newPositions.on) {
        this.currentOrientation = CursorOrientation.On;
        return true;
      } else if (newPositions.before && !NodeUtils.hasSomeChildren(this.nodeNavigator.tip.node)) {
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

  public navigateToPrecedingSiblingUnchecked(): boolean {
    if (this.nodeNavigator.navigateToPrecedingSibling()) {
      this.currentOrientation = CursorOrientation.After;
      return true;
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
        const positions = PositionClassification.getValidCursorOrientationsAt(clone.nodeNavigator, this.layoutReporter);
        if (!positions.before && !positions.on && !positions.after) {
          clone.navigateToPrecedingCursorPosition();
        }
      }

      this.currentOrientation = clone.currentOrientation;
      this.nodeNavigator = clone.nodeNavigator;
    }
    return false;
  }

  public navigateToUnchecked(cursor: Cursor): boolean;
  public navigateToUnchecked(path: PathString | Path, orientation: CursorOrientation): boolean;
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
  public navigateToUnchecked(cursorOrPath: any, maybeOrientation?: CursorOrientation): boolean {
    if (typeof cursorOrPath === "string") {
      return this.navigateToUnchecked(
        Path.parse(cursorOrPath),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        maybeOrientation as any
      );
    }

    let path: Path;
    let orientation: CursorOrientation;
    if ((cursorOrPath as Path).parts?.length >= 0) {
      path = cursorOrPath as Path;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      orientation = maybeOrientation!;
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
