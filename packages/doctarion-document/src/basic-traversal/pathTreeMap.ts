import { Path } from "./path";
import { PathPart } from "./pathPart";

// This will have to be changed once path parts have string components again
type PathPartKey = number;

// Note this is mutable
interface Node<ElementType> {
  childNodes: Map<PathPartKey, Node<ElementType>>;
  elements: ElementType[];
}

export enum PathTreeMapChildNodePolcy {
  Allow = "ALLOW", // The default
  Lift = "LIFT",
  Drop = "DROP",
}

export interface PathTreeMapOptions {
  childNodesPolicy?: PathTreeMapChildNodePolcy;
}

export class PathTreeMap<ElementType> {
  private root: Node<ElementType>;

  public constructor(private readonly options?: PathTreeMapOptions) {
    this.root = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      childNodes: new Map(),
      elements: [],
    };
  }

  public add(path: Path, element: ElementType): void {
    const shouldLift = this.options?.childNodesPolicy === PathTreeMapChildNodePolcy.Lift;
    const shouldDrop = this.options?.childNodesPolicy === PathTreeMapChildNodePolcy.Drop;

    let currentNode = this.root;
    let pIndex = 0;
    while (path.parts.length > pIndex) {
      const nextPart = path.parts[pIndex];
      const nextPartKey = this.getKey(nextPart);

      if (currentNode.childNodes.has(nextPartKey)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        currentNode = currentNode.childNodes.get(nextPartKey)!;
      } else if (shouldDrop && currentNode.elements.length > 0) {
        // Drop it, there is a ancestor path that already has elements
        return;
      } else if (shouldLift && currentNode.elements.length > 0) {
        // We are done early
        break;
      } else {
        const newChildNode: Node<ElementType> = {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          childNodes: new Map(),
          elements: [],
        };
        currentNode.childNodes.set(nextPartKey, newChildNode);
        currentNode = newChildNode;
      }
      pIndex++;
    }

    if (shouldLift && currentNode.childNodes.size > 0) {
      for (const node of this.traverse(currentNode)) {
        for (const element of node.elements) {
          currentNode.elements.push(element);
        }
      }
      currentNode.childNodes.clear();
    }
    if (shouldDrop && currentNode.childNodes.size > 0) {
      currentNode.childNodes.clear();
    }
    currentNode.elements.push(element);
  }

  /**
   * Returns all elements added at the exact path given.
   */
  public getExact(path: Path): ElementType[] | undefined {
    let currentNode = this.root;
    let pIndex = 0;
    // eslint-disable-next-line no-constant-condition
    while (path.parts.length > pIndex) {
      const nextPart = path.parts[pIndex];
      const nextPartKey = this.getKey(nextPart);

      const childIsPresent = currentNode.childNodes.has(nextPartKey);
      if (childIsPresent) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        currentNode = currentNode.childNodes.get(nextPartKey)!;
      } else {
        return undefined;
      }
      pIndex++;
    }

    return currentNode.elements.length > 0 ? currentNode.elements : undefined;
  }

  /**
   * Returns all elements added at the exact path given, or if the `PathTreeMap`
   * was created w/ a `childNodesPolicy` of `PathTreeMapChildNodePolcy.LIFT` or
   * `PathTreeMapChildNodePolcy.DROP` this will return all elements at the
   * closest ancestor to the path in the `PathTreeMap` as well as all elements
   * from all of its other descendents.
   */
  public getFlexible(path: Path): ElementType[] | undefined {
    let currentNode = this.root;
    let pIndex = 0;
    // eslint-disable-next-line no-constant-condition
    while (path.parts.length > pIndex) {
      const nextPart = path.parts[pIndex];
      const nextPartKey = this.getKey(nextPart);

      const childIsPresent = currentNode.childNodes.has(nextPartKey);
      if (childIsPresent) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        currentNode = currentNode.childNodes.get(nextPartKey)!;
      } else if (currentNode.elements.length > 0) {
        // This might be fine, if there are elements at this node
        return currentNode.elements.length > 0 ? currentNode.elements : undefined;
      } else {
        return undefined;
      }
      pIndex++;
    }

    return currentNode.elements.length > 0 ? currentNode.elements : undefined;
  }

  /**
   * Returns true if the exact path given is in the `PathTreeMap`, or if the
   * `PathTreeMap` was created w/ a `childNodesPolicy` of
   * `PathTreeMapChildNodePolcy.LIFT` or `PathTreeMapChildNodePolcy.DROP` this
   * will return true if the path itself is in the `PathTreeMap`, or if an
   * ancestor (so to speak) of the path is in the `PathTreeMap`.
   */
  public hasPath(path: Path): boolean {
    const allowAncestors =
      this.options?.childNodesPolicy === PathTreeMapChildNodePolcy.Lift ||
      this.options?.childNodesPolicy === PathTreeMapChildNodePolcy.Drop;

    let currentNode = this.root;
    let pIndex = 0;
    // eslint-disable-next-line no-constant-condition
    while (path.parts.length > pIndex) {
      const nextPart = path.parts[pIndex];
      const nextPartKey = this.getKey(nextPart);

      const childIsPresent = currentNode.childNodes.has(nextPartKey);
      if (childIsPresent) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        currentNode = currentNode.childNodes.get(nextPartKey)!;
      } else if (allowAncestors) {
        // This might be fine, if there are elements at this node
        return currentNode.elements.length > 0;
      } else {
        return false;
      }
      pIndex++;
    }

    return currentNode.elements.length > 0;
  }

  private getKey(part: PathPart): PathPartKey {
    // This will have to be changed once path parts have string components again
    return part.index;
  }

  private *traverse(node: Node<ElementType>) {
    const toVisit = [node];
    while (toVisit.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const p = toVisit.shift()!;
      yield p;
      const kids = p?.childNodes.values();
      if (kids) {
        for (const k of kids) {
          toVisit.push(k);
        }
      }
    }
  }
}
