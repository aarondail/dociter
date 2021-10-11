// -----------------------------------------------------------------------------
// I am no longer really sure we need this class.
// I thought we did, so that when executing an operation affecting multiple
// interactors we would want to intelligently eliminate overlapping interactors
// and stuff. Now I'm not sure, I removed this from the deletionOps and nothing
// broke, but maybe I need a specific test (maybe I have one?).
// -----------------------------------------------------------------------------

import { SimpleComparison } from "../miscUtils";

import { Path } from "./path";
import { PathPart } from "./pathPart";

// This will have to be changed once path parts have string components again
type PathPartKey = number;

// Note this is mutable.
interface InteriorNode<ElementType> {
  type: "INTERIOR";
  childNodes: Map<PathPartKey, Node<ElementType>>;
}

// Note this is mutable.
interface EdgeNode<ElementType> {
  type: "EDGE";
  path: Path;
  // There can be more than one element, but these are ONLY elements added for the
  // exact path this node maps to. Elements for descendant paths are stored in
  // the liftedElements property (or dropped depending on config).
  elements: ElementType[];
  liftedElements: ElementType[];
}

type Node<ElementType> = InteriorNode<ElementType> | EdgeNode<ElementType>;

/**
 * Stores a map of paths to `ElementType`. It is different than a normal `Map`
 * in how it deals with path's that have an ancestor/descendant relationship
 * specially by "lifting" any descedants up to be in another property alongside
 * the ancestor.
 */
export class LiftingPathMap<ElementType> {
  private root: Node<ElementType>;

  public constructor() {
    this.root = {
      type: "INTERIOR",
      childNodes: new Map(),
    };
  }

  public add(path: Path, element: ElementType): void {
    let createdNewNodes = false;
    let currentNode = this.root;
    let pIndex = 0;
    while (path.parts.length > pIndex) {
      const nextPart = path.parts[pIndex];
      const nextPartKey = this.getKey(nextPart);

      if (currentNode.type === "INTERIOR") {
        if (currentNode.childNodes.has(nextPartKey)) {
          currentNode = currentNode.childNodes.get(nextPartKey)!;
        } else {
          createdNewNodes = true;
          const newChildNode: Node<ElementType> = {
            type: "INTERIOR",
            childNodes: new Map(),
          };
          currentNode.childNodes.set(nextPartKey, newChildNode);
          currentNode = newChildNode;
        }
        pIndex++;
      } else {
        // If its an EdgeNode we can't continue
        break;
      }
    }

    if (createdNewNodes) {
      // In this case we are sure that we created the currentNode above (as an
      // InteriorNode) so we just convert it to an EdgeNode.
      currentNode.type = "EDGE";
      (currentNode as any).childNodes = undefined;
      (currentNode as EdgeNode<ElementType>).path = path;
      (currentNode as EdgeNode<ElementType>).elements = [element];
      (currentNode as EdgeNode<ElementType>).liftedElements = [];
    } else {
      if (currentNode.type === "EDGE") {
        if (pIndex === path.parts.length) {
          currentNode.elements.push(element);
        } else {
          currentNode.liftedElements.push(element);
        }
      } else {
        // In this case we landed on an InteriorNode, which we have to convert
        // to an EdgeNode.
        const liftedElements = [];
        if (currentNode.childNodes.size > 0) {
          for (const node of this.traverseNodeAndChildren(currentNode)) {
            if (node.type === "EDGE") {
              for (const element of node.elements) {
                liftedElements.push(element);
              }
              for (const element of node.liftedElements) {
                liftedElements.push(element);
              }
            }
          }
        }
        const currentNodeReadyForMutation = currentNode as any;
        currentNodeReadyForMutation.type = "EDGE";
        currentNodeReadyForMutation.childNodes = undefined;
        (currentNodeReadyForMutation as EdgeNode<ElementType>).path = path;
        (currentNodeReadyForMutation as EdgeNode<ElementType>).elements = [element];
        (currentNodeReadyForMutation as EdgeNode<ElementType>).liftedElements = liftedElements;
      }
    }
  }

  /**
   * Returns all elements added at the exact path given.
   */
  public get(path: Path): Pick<EdgeNode<ElementType>, "elements" | "liftedElements" | "path"> | undefined {
    let currentNode = this.root;
    let pIndex = 0;
    // eslint-disable-next-line no-constant-condition
    while (path.parts.length > pIndex) {
      const nextPart = path.parts[pIndex];
      const nextPartKey = this.getKey(nextPart);

      if (currentNode.type === "INTERIOR") {
        const childIsPresent = currentNode.childNodes.has(nextPartKey);
        if (childIsPresent) {
          currentNode = currentNode.childNodes.get(nextPartKey)!;
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }

      pIndex++;
    }

    if (currentNode.type === "EDGE") {
      return currentNode;
    }
    return undefined;
  }

  /**
   * Importantly, paths are ordered such that children come after parents and
   * before siblings (see Path for more on that).
   */
  public getAllOrderedByPaths(): Pick<EdgeNode<ElementType>, "elements" | "liftedElements" | "path">[] {
    const result = [];
    for (const n of this.traverseNodeAndChildren(this.root)) {
      if (n.type === "EDGE") {
        result.push(n);
      }
    }

    result.sort((a, b) => {
      const cmp = a.path.compareToSimple(b.path);
      if (cmp === SimpleComparison.Before) {
        return -1;
      } else if (cmp === SimpleComparison.After) {
        return 1;
      }
      return 0;
    });
    return result;
  }

  private getKey(part: PathPart): PathPartKey {
    // This will have to be changed once path parts have string components again
    return part.index;
  }

  private *traverseNodeAndChildren(node: Node<ElementType>) {
    const toVisit = [node];
    while (toVisit.length > 0) {
      const p = toVisit.shift()!;
      yield p;
      if (p.type === "INTERIOR") {
        const kids = p.childNodes.values();
        if (kids) {
          for (const k of kids) {
            toVisit.push(k);
          }
        }
      }
    }
  }
}
