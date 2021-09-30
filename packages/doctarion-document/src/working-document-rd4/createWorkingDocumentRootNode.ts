/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { FriendlyIdGenerator } from "doctarion-utils";
import lodash from "lodash";

import { PathPart } from "../basic-traversal-rd4";
import {
  Anchor,
  AnchorRange,
  AutoFlowColumns,
  BlockQuote,
  CodeBlock,
  Column,
  Columns,
  Comment,
  Document,
  EntityRef,
  ExtendedComment,
  Floater,
  Footer,
  Grid,
  GridCell,
  Header,
  Hero,
  Hyperlink,
  List,
  ListItem,
  Media,
  Node,
  Paragraph,
  Sidebar,
  Span,
  Tag,
  Todo,
} from "../document-model-rd4";

import { AnchorId, WorkingAnchor, WorkingAnchorRange } from "./anchor";
import { WorkingDocumentError } from "./error";
import {
  NodeId,
  WorkingAutoFlowColumns,
  WorkingBlockQuote,
  WorkingCodeBlock,
  WorkingColumn,
  WorkingColumns,
  WorkingComment,
  WorkingDocumentRootNode,
  WorkingEntityRef,
  WorkingExtendedComment,
  WorkingFloater,
  WorkingFooter,
  WorkingGrid,
  WorkingGridCell,
  WorkingHeader,
  WorkingHero,
  WorkingHyperlink,
  WorkingList,
  WorkingListItem,
  WorkingMedia,
  WorkingNode,
  WorkingParagraph,
  WorkingSidebar,
  WorkingSpan,
  WorkingTag,
  WorkingTodo,
} from "./nodes";

export function createWorkingDocumentRootNode(
  idGenerator: FriendlyIdGenerator,
  root: Document
): { root: WorkingDocumentRootNode; nodes: Map<NodeId, WorkingNode>; anchors: Map<AnchorId, WorkingAnchor> } {
  const nodeToWorkingNodeMap: Map<Node, WorkingNode> = new Map();
  const newAnchors: Map<AnchorId, WorkingAnchor> = new Map();
  const newNodes: Map<NodeId, WorkingNode> = new Map();

  const mapPropertyValue = (value: any, container: WorkingNode, propertyName: string, index?: number): any => {
    if (value instanceof Anchor) {
      const anchor = anchorToWorkingAnchors(idGenerator, value, container);
      newAnchors.set(anchor.id, anchor);
      return anchor;
    } else if (value instanceof AnchorRange) {
      const anchors = anchorRangeToWorkingAnchors(idGenerator, value, container);
      newAnchors.set(anchors.from.id, anchors.from);
      newAnchors.set(anchors.to.id, anchors.to);
      return anchors;
    } else if (value instanceof Node) {
      const n = mapNode(value);
      n.parent = container;
      n.pathPartFromParent =
        propertyName === "children"
          ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            new PathPart(index!)
          : index === undefined
          ? new PathPart(propertyName)
          : new PathPart(propertyName, index);
      return n;
    } else if (Array.isArray(value)) {
      return value.map((v, idx) => mapPropertyValue(v, container, propertyName, idx));
    } else {
      // This could DEFINITELY do the wrong thing but hopefully the fact
      // that our WorkingXyz types use NodePropertyToWorkingNodeProperty
      // which maps unknown cases to never will catch things.
      return lodash.clone(value);
    }
  };

  const mapNode = (node: Node): WorkingNode => {
    const { ctor, name } = getWorkingNodeConstructorCorrespondingToNodeInstance(node);
    const id = idGenerator.generateId(name);
    const newNode = new ctor(id);
    newNodes.set(id, newNode);
    nodeToWorkingNodeMap.set(node, newNode);

    const nodeAsAny = node as any;
    for (const key of Object.getOwnPropertyNames(nodeAsAny)) {
      const value = nodeAsAny[key];
      newNode[key] = mapPropertyValue(value, newNode, key);
    }

    return newNode;
  };

  const newRoot = mapNode(root);

  for (const workingAnchor of newAnchors.values()) {
    const oldNode: Node = workingAnchor.node;
    const newNode = nodeToWorkingNodeMap.get(oldNode);
    if (!newNode) {
      throw new WorkingDocumentError("Could not find WorkingNode to assign to new WorkingAnchor.");
    }
    workingAnchor.node = newNode;
    newNode.attachedAnchors.set(workingAnchor.id, workingAnchor);
  }

  return { root: newRoot as WorkingDocumentRootNode, nodes: newNodes, anchors: newAnchors };
}

function anchorToWorkingAnchors(
  idGenerator: FriendlyIdGenerator,
  anchor: Anchor,
  newWorkingNode: WorkingNode
): WorkingAnchor {
  return new WorkingAnchor(
    idGenerator.generateId("ANCHOR"),
    newWorkingNode,
    anchor.orientation,
    anchor.graphemeIndex,
    undefined,
    undefined
  );
}

function anchorRangeToWorkingAnchors(
  idGenerator: FriendlyIdGenerator,
  anchors: AnchorRange,
  newWorkingNode: WorkingNode
): WorkingAnchorRange {
  return new WorkingAnchorRange(
    anchorToWorkingAnchors(idGenerator, anchors.from, newWorkingNode),
    anchorToWorkingAnchors(idGenerator, anchors.to, newWorkingNode)
  );
}

const getWorkingNodeConstructorCorrespondingToNodeInstance = (node: Node): any => {
  // ANNOTATIONS
  if (node instanceof Floater) {
    return { ctor: WorkingFloater, name: "FLOATER" };
  } else if (node instanceof Footer) {
    return { ctor: WorkingFooter, name: "FOOTER" };
  } else if (node instanceof Comment) {
    return { ctor: WorkingComment, name: "COMMENT" };
  }
  // BLOCKS
  if (node instanceof Paragraph) {
    return { ctor: WorkingParagraph, name: "PARAGRAPH" };
  } else if (node instanceof Header) {
    return { ctor: WorkingHeader, name: "HEADER" };
  } else if (node instanceof CodeBlock) {
    return { ctor: WorkingCodeBlock, name: "CODEBLOCK" };
  } else if (node instanceof BlockQuote) {
    return { ctor: WorkingBlockQuote, name: "BLOCKQUOTE" };
  } else if (node instanceof Hero) {
    return { ctor: WorkingHero, name: "HERO" };
  } else if (node instanceof Media) {
    return { ctor: WorkingMedia, name: "MEDIA" };
  }
  // DOCUMENT
  if (node instanceof Document) {
    return { ctor: WorkingDocumentRootNode, name: "DOCUMENT" };
  }
  // INLINES
  if (node instanceof Span) {
    return { ctor: WorkingSpan, name: "SPAN" };
  } else if (node instanceof Hyperlink) {
    return { ctor: WorkingHyperlink, name: "HYPERLINK" };
  } else if (node instanceof EntityRef) {
    return { ctor: WorkingEntityRef, name: "ENTITYREF" };
  } else if (node instanceof Todo) {
    return { ctor: WorkingTodo, name: "TODO" };
  } else if (node instanceof Tag) {
    return { ctor: WorkingTag, name: "TAG" };
  }
  // LATERALS
  if (node instanceof Sidebar) {
    return { ctor: WorkingSidebar, name: "SIDEBAR" };
  } else if (node instanceof ExtendedComment) {
    return { ctor: WorkingExtendedComment, name: "EXTENDEDCOMMENT" };
  }
  // SUPER BLOCKS
  if (node instanceof List) {
    return { ctor: WorkingList, name: "LIST" };
  } else if (node instanceof ListItem) {
    return { ctor: WorkingListItem, name: "LISTITEM" };
  } else if (node instanceof Grid) {
    return { ctor: WorkingGrid, name: "GRID" };
  } else if (node instanceof GridCell) {
    return { ctor: WorkingGridCell, name: "GRIDCELL" };
  } else if (node instanceof Columns) {
    return { ctor: WorkingColumns, name: "COLUMNS" };
  } else if (node instanceof Column) {
    return { ctor: WorkingColumn, name: "COLUMN" };
  } else if (node instanceof AutoFlowColumns) {
    return { ctor: WorkingAutoFlowColumns, name: "AUTOFLOWCOLUMNS" };
  }
};

// const mapFnPrime = (node: Node): WorkingNode => {
//   // ANNOTATIONS
//   if (node instanceof Floater) {
//     const children = node.children.map(mapFn);
//     const newNode = new WorkingFloater(
//       idGenerator.generateId("FLOATER"),
//       children,
//       // Cheat with the working node
//       // eslint-disable-next-line @typescript-eslint/no-explicit-any
//       anchorOrAnchorRangeToWorkingAnchors(idGenerator, node.anchors, node as any),
//       node.placement
//     );
//     // Children
//     children.forEach((c) => (c.parent = newNode));
//     // Target of the anchors will be filled in later
//     if (newNode.anchors instanceof WorkingAnchor) {
//       newAnchorsWithImproperTargets.push(newNode.anchors);
//     } else {
//       newAnchorsWithImproperTargets.push(newNode.anchors.anterior);
//       newAnchorsWithImproperTargets.push(newNode.anchors.posterior);
//     }

//     return newNode;
//   } else if (node instanceof Footer) {
//     const children = node.children.map(mapFn);
//     const newNode = new WorkingFooter(
//       idGenerator.generateId("FOOTER"),
//       children,
//       // Cheat with the working node
//       // eslint-disable-next-line @typescript-eslint/no-explicit-any
//       anchorToWorkingAnchors(idGenerator, node.anchor, node as any)
//     );
//     children.forEach((c) => (c.parent = newNode));
//     newAnchorsWithImproperTargets.push(newNode.anchor);
//     return newNode;
//   } else if (node instanceof Comment) {
//     const children = node.children.map(mapFn);
//     const newNode = new WorkingFloater(
//       idGenerator.generateId("FLOATER"),
//       children,
//       // Cheat with the working node
//       // eslint-disable-next-line @typescript-eslint/no-explicit-any
//       anchorOrAnchorRangeToWorkingAnchors(idGenerator, node.anchors, node as any),
//       node.placement
//     );
//     // Children
//     children.forEach((c) => (c.parent = newNode));
//     // Target of the anchors will be filled in later
//     if (newNode.anchors instanceof WorkingAnchor) {
//       newAnchorsWithImproperTargets.push(newNode.anchors);
//     } else {
//       newAnchorsWithImproperTargets.push(newNode.anchors.anterior);
//       newAnchorsWithImproperTargets.push(newNode.anchors.posterior);
//     }

//     return newNode;
//   }

//   // BLOCKS
// };
