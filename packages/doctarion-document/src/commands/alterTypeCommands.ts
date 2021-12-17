// import { Node, NodeCategory, NodeChildrenType } from "../document-model-rd5";
// import { ReadonlyWorkingNode } from "../working-document-rd4";

// import { CommandError } from "./error";
// import { TargetPayload } from "./payloads";
// import { coreCommand } from "./types";
// import { CommandUtils, SelectTargetsSort } from "./utils";

// export enum AlterType {
//   Blocks = "BLOCKS",
//   Inlines = "INLINES",
// }

// interface AlterOptions {
//   readonly type: AlterType;
//   readonly template: NodeTemplate;
// }

// export type AlterPayload = TargetPayload & AlterOptions;

// export const alterType = coreCommand<AlterPayload>("alterType", (state, services, payload) => {
//   const targets = CommandUtils.selectTargets(state, payload.target, SelectTargetsSort.Reversed);

//   if (payload.type === AlterType.Blocks) {
//     if (
//       payload.template.nodeType.category !== NodeCategory.Block ||
//       payload.template.nodeType.childrenType !== NodeChildrenType.Inlines
//     ) {
//       throw new CommandError(
//         "Cannot alter blocks to a non-block node type, or a node type that does not have inlines as children."
//       );
//     }

//     const blocks = new Set<ReadonlyWorkingNode>();
//     for (const target of targets) {
//       if (target.selectionAnchorNavigator) {
//         CommandUtils.walkBlocksInSelectionTarget(
//           state,
//           target,
//           (n) =>
//             (n.tip.node as ReadonlyWorkingNode).nodeType.childrenType === NodeChildrenType.Inlines &&
//             blocks.add(n.tip.node as ReadonlyWorkingNode)
//         );
//       } else {
//         // Change the whole node being pointed to
//         const n = CommandUtils.findAncestorBlockNodeWithNavigator(target.mainAnchorNavigator);
//         if (!n) {
//           continue;
//         }
//         const node = n.node;
//         if (node.nodeType.childrenType === NodeChildrenType.Inlines) {
//           blocks.add(node);
//         }
//       }
//     }

//     for (const block of blocks.values()) {
//       state.alterNodeTypeOfNode(block, payload.template.nodeType, payload.template.facets);
//     }
//   } else if (payload.type === AlterType.Inlines) {
//     if (
//       payload.template.nodeType.category !== NodeCategory.Inline ||
//       payload.template.nodeType.childrenType !== NodeChildrenType.FancyText
//     ) {
//       throw new CommandError(
//         "Cannot alter inlines to a non-inline node type, or a node type that does not have fancy text as children."
//       );
//     }

//     const inlines = new Set<ReadonlyWorkingNode>();
//     for (const target of targets) {
//       if (target.selectionAnchorNavigator) {
//         CommandUtils.walkInlinesInSelectionTarget(
//           state,
//           target,
//           (n) =>
//             (n.tip.node as ReadonlyWorkingNode).nodeType.childrenType === NodeChildrenType.FancyText &&
//             inlines.add(n.tip.node as ReadonlyWorkingNode)
//         );
//       } else {
//         // Change the whole node being pointed to
//         const n = CommandUtils.findAncestorInlineNodeWithNavigator(target.mainAnchorNavigator);
//         const node = n?.node;
//         if (
//           node &&
//           node.nodeType.category === NodeCategory.Inline &&
//           node.nodeType.childrenType === NodeChildrenType.FancyText
//         ) {
//           inlines.add(node);
//         }
//       }
//     }

//     for (const inline of inlines.values()) {
//       state.alterNodeTypeOfNode(inline, payload.template.nodeType, payload.template.facets);
//     }
//   }
// });

export const TODO = 0;
