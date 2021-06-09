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
  // There can be more than one element, but these are ONLY elements add for the
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          currentNode = currentNode.childNodes.get(nextPartKey)!;
        } else {
          createdNewNodes = true;
          const newChildNode: Node<ElementType> = {
            type: "INTERIOR",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      (currentNode as any).childNodes = undefined;
      (currentNode as EdgeNode<ElementType>).elements = [element];
      (currentNode as EdgeNode<ElementType>).liftedElements = [];
    } else {
      if (currentNode.type === "EDGE") {
        if (pIndex === path.parts.length - 1) {
          currentNode.elements.push(element);
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        const currentNodeReadyForMutation = currentNode as any;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        currentNodeReadyForMutation.type = "EDGE";
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-member-access
        currentNodeReadyForMutation.childNodes = undefined;
        (currentNodeReadyForMutation as EdgeNode<ElementType>).elements = [element];
        (currentNodeReadyForMutation as EdgeNode<ElementType>).liftedElements = liftedElements;
      }
    }
  }

  /**
   * Returns all elements added at the exact path given.
   */
  public get(path: Path): Pick<EdgeNode<ElementType>, "elements" | "liftedElements"> | undefined {
    let currentNode = this.root;
    let pIndex = 0;
    // eslint-disable-next-line no-constant-condition
    while (path.parts.length > pIndex) {
      const nextPart = path.parts[pIndex];
      const nextPartKey = this.getKey(nextPart);

      if (currentNode.type === "INTERIOR") {
        const childIsPresent = currentNode.childNodes.has(nextPartKey);
        if (childIsPresent) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

  private getKey(part: PathPart): PathPartKey {
    // This will have to be changed once path parts have string components again
    return part.index;
  }

  private *traverseNodeAndChildren(node: Node<ElementType>) {
    const toVisit = [node];
    while (toVisit.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
