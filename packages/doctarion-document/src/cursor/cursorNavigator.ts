import { Chain, ChainLink, NodeNavigator, Path, PathString } from "../basic-traversal";
import { NodeLayoutReporter } from "../layout-reporting";
import { Document, NodeUtils } from "../models";

import { Cursor, CursorAffinity } from "./cursor";
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
  private currentAffinity: CursorAffinity;
  // This nodeNavigator stores the current node the cursor is on
  private nodeNavigator: NodeNavigator;

  public constructor(public readonly document: Document, private readonly layoutReporter?: NodeLayoutReporter) {
    // The document is always at the root of the chain
    this.currentAffinity = CursorAffinity.Neutral;
    this.nodeNavigator = new NodeNavigator(document);
  }

  public get chain(): Chain {
    return this.nodeNavigator.chain;
  }

  public get tip(): ChainLink {
    return this.nodeNavigator.tip;
  }

  public get cursor(): Cursor {
    return new Cursor(this.nodeNavigator.path, this.currentAffinity);
  }

  public classifyCurrentPosition(): PositionClassification | undefined {
    const el = this.nodeNavigator.tip.node;
    if (NodeUtils.isGrapheme(el)) {
      return PositionClassification.Grapheme;
    } else if (PositionClassification.isEmptyInsertionPoint(el)) {
      return PositionClassification.EmptyInsertionPoint;
    } else if (PositionClassification.isInBetweenInsertionPoint(el, this.nodeNavigator.precedingSiblingNode)) {
      return PositionClassification.InBetweenInsertionPoint;
    }
    return undefined;
  }

  public clone(): CursorNavigator {
    const navigator = new CursorNavigator(this.document, this.layoutReporter);
    navigator.currentAffinity = this.currentAffinity;
    navigator.nodeNavigator = this.nodeNavigator.clone();
    return navigator;
  }

  /**
   * Note that when navigating to a grapheme with before affinity, the
   * navigator may choose to use an earlier point with after affinity.
   */
  public navigateTo(cursor: Cursor): boolean;
  public navigateTo(path: PathString | Path, affinity?: CursorAffinity): boolean;
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
  public navigateTo(cursorOrPath: any, maybeAffinity?: CursorAffinity): boolean {
    const temp = this.clone();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!temp.navigateToUnchecked(cursorOrPath, maybeAffinity || CursorAffinity.Neutral)) {
      return false;
    }

    this.nodeNavigator = temp.nodeNavigator;
    this.currentAffinity = temp.currentAffinity;

    if (this.navigateToNextCursorPosition()) {
      this.navigateToPrecedingCursorPosition();
    } else {
      const positions = PositionClassification.getValidCursorAffinitiesAt(this.nodeNavigator, this.layoutReporter);
      if (!positions.before && !positions.neutral && !positions.after) {
        this.navigateToPrecedingCursorPosition();
      }
    }

    return true;
  }

  public navigateToFirstDescendantCursorPosition(): boolean {
    const ancestor = this.nodeNavigator.tip.node;
    if (PositionClassification.isEmptyInsertionPoint(this.nodeNavigator.tip.node)) {
      this.currentAffinity = CursorAffinity.Neutral;
      return true;
    }
    return this.complexNavigationHelper({
      init: (nav) => (nav.currentAffinity = CursorAffinity.Before),
      advance: (nav) => nav.navigateToNextCursorPosition(),
      abort: (nav) => !nav.nodeNavigator.chain.contains(ancestor),
      success: (nav) => nav.tip.node !== ancestor,
    });
  }

  public navigateToLastDescendantCursorPosition(): boolean {
    const ancestor = this.nodeNavigator.tip.node;
    if (PositionClassification.isEmptyInsertionPoint(this.nodeNavigator.tip.node)) {
      this.currentAffinity = CursorAffinity.Neutral;
      return true;
    }
    return this.complexNavigationHelper({
      init: (nav) => (nav.currentAffinity = CursorAffinity.After),
      advance: (nav) => nav.navigateToPrecedingCursorPosition(),
      abort: (nav) => !nav.nodeNavigator.chain.contains(ancestor),
      success: (nav) => nav.tip.node !== ancestor,
    });
  }

  public navigateToNextCursorPosition(): boolean {
    const affinity = this.currentAffinity;
    let skipDescendants = false;

    // This block of code is responsible for changing the cursor affinity from
    // before or neutral to another affinity without changing the node that the
    // navigator is on
    if (affinity === CursorAffinity.Before) {
      const positions = PositionClassification.getValidCursorAffinitiesAt(this.nodeNavigator, this.layoutReporter);
      if (positions.neutral) {
        this.currentAffinity = CursorAffinity.Neutral;
        return true;
      } else if (positions.after && !NodeUtils.hasChildren(this.nodeNavigator.tip.node)) {
        this.currentAffinity = CursorAffinity.After;
        return true;
      }
    } else if (affinity === CursorAffinity.Neutral) {
      const positions = PositionClassification.getValidCursorAffinitiesAt(this.nodeNavigator, this.layoutReporter);
      if (positions.after) {
        this.currentAffinity = CursorAffinity.After;
        return true;
      }
    } else if (affinity === CursorAffinity.After) {
      if (this.nodeNavigator.nextSiblingNode === undefined) {
        // Check parents
        const parentNavigator = this.nodeNavigator.cloneWithoutTip();
        const parentPositions = PositionClassification.getValidCursorAffinitiesAt(parentNavigator, this.layoutReporter);
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
      const newPositions = PositionClassification.getValidCursorAffinitiesAt(this.nodeNavigator, this.layoutReporter);
      if (newPositions.before) {
        this.currentAffinity = CursorAffinity.Before;
        return true;
      } else if (newPositions.neutral) {
        this.currentAffinity = CursorAffinity.Neutral;
        return true;
      } else if (newPositions.after && !NodeUtils.hasChildren(this.nodeNavigator.tip.node)) {
        this.currentAffinity = CursorAffinity.After;
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
        this.currentAffinity = clone.currentAffinity;
        this.nodeNavigator = clone.nodeNavigator;
        return true;
      }
    }
    return false;
  }

  public navigateToNextSiblingUnchecked(): boolean {
    if (this.nodeNavigator.navigateToNextSibling()) {
      this.currentAffinity = CursorAffinity.Before;
      return true;
    }
    return false;
  }

  public navigateToParentUnchecked(): boolean {
    if (this.nodeNavigator.navigateToParent()) {
      this.currentAffinity = CursorAffinity.Neutral;
      return true;
    }
    return false;
  }

  public navigateToPrecedingCursorPosition(): boolean {
    const affinity = this.currentAffinity;
    let skipDescendants = false;

    if (affinity === CursorAffinity.After) {
      const positions = PositionClassification.getValidCursorAffinitiesAt(this.nodeNavigator, this.layoutReporter);
      if (positions.neutral) {
        this.currentAffinity = CursorAffinity.Neutral;
        return true;
      } else if (positions.before && !NodeUtils.hasChildren(this.nodeNavigator.tip.node)) {
        this.currentAffinity = CursorAffinity.Before;
        return true;
      }
    } else if (affinity === CursorAffinity.Neutral) {
      const positions = PositionClassification.getValidCursorAffinitiesAt(this.nodeNavigator, this.layoutReporter);
      if (positions.before) {
        this.currentAffinity = CursorAffinity.Before;
        return true;
      }
    } else if (affinity === CursorAffinity.Before) {
      if (this.nodeNavigator.precedingSiblingNode === undefined) {
        // Check parents
        const parentNavigator = this.nodeNavigator.cloneWithoutTip();
        const parentPositions = PositionClassification.getValidCursorAffinitiesAt(parentNavigator, this.layoutReporter);
        if (parentPositions.before) {
          this.nodeNavigator = parentNavigator;
          return true;
        }
      }
      skipDescendants = true;
    }

    const backup = this.nodeNavigator.clone();
    while (this.nodeNavigator.navigateBackwardsInDfs({ skipDescendants })) {
      const newPositions = PositionClassification.getValidCursorAffinitiesAt(this.nodeNavigator, this.layoutReporter);
      if (newPositions.after) {
        this.currentAffinity = CursorAffinity.After;
        return true;
      } else if (newPositions.neutral) {
        this.currentAffinity = CursorAffinity.Neutral;
        return true;
      } else if (newPositions.before && !NodeUtils.hasChildren(this.nodeNavigator.tip.node)) {
        this.currentAffinity = CursorAffinity.Before;
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
        this.currentAffinity = clone.currentAffinity;
        this.nodeNavigator = clone.nodeNavigator;
        return true;
      }
    }
    return false;
  }

  public navigateToPrecedingSiblingUnchecked(): boolean {
    if (this.nodeNavigator.navigateToPrecedingSibling()) {
      this.currentAffinity = CursorAffinity.After;
      return true;
    }
    return false;
  }

  public navigateToRelativeSibling(offset: number, affinity: CursorAffinity): boolean {
    const clone = this.clone();
    if (clone.nodeNavigator.navigateToRelativeSibling(offset)) {
      clone.currentAffinity = affinity;

      if (clone.navigateToNextCursorPosition()) {
        clone.navigateToPrecedingCursorPosition();
      } else {
        const positions = PositionClassification.getValidCursorAffinitiesAt(clone.nodeNavigator, this.layoutReporter);
        if (!positions.before && !positions.neutral && !positions.after) {
          clone.navigateToPrecedingCursorPosition();
        }
      }

      this.currentAffinity = clone.currentAffinity;
      this.nodeNavigator = clone.nodeNavigator;
    }
    return false;
  }

  public navigateToUnchecked(cursor: Cursor): boolean;
  public navigateToUnchecked(path: PathString | Path, affinity: CursorAffinity): boolean;
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
  public navigateToUnchecked(cursorOrPath: any, maybeAffinity?: CursorAffinity): boolean {
    if (typeof cursorOrPath === "string") {
      return this.navigateToUnchecked(
        Path.parse(cursorOrPath),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        maybeAffinity as any
      );
    }

    let path: Path;
    let affinity: CursorAffinity;
    if ((cursorOrPath as Path).parts?.length >= 0) {
      path = cursorOrPath as Path;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      affinity = maybeAffinity!;
    } else {
      path = (cursorOrPath as Cursor).at;
      affinity = (cursorOrPath as Cursor).affinity;
    }

    const n = new NodeNavigator(this.document);
    if (!n.navigateTo(path)) {
      return false;
    }
    this.nodeNavigator = n;
    this.currentAffinity = affinity;
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
          this.currentAffinity = clone.currentAffinity;
          this.nodeNavigator = clone.nodeNavigator;
          return true;
        }
      } else {
        return false;
      }
    }
  }
}
