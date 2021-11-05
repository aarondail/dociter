import { WorkingDocument } from "../../src/working-document-rd4";

export function dumpAnchorsFromWorkingDocument(wd: WorkingDocument): string {
  let s = "";
  for (const [, anchor] of wd.anchors.entries()) {
    s += `Anchor: ${anchor.name ?? "∅"} ${anchor.orientation} (${anchor.node.nodeType.name})${wd
      .getNodePath(anchor.node)
      .toString()}${anchor.graphemeIndex !== undefined ? "⁙" + anchor.graphemeIndex + " " : " "}${
      anchor.relatedInteractor
        ? anchor.relatedInteractor.name
          ? "intr: " + anchor.relatedInteractor.name + " "
          : "intr: ∅"
        : ""
    }${
      anchor.relatedOriginatingNode
        ? "from: (" + anchor.relatedOriginatingNode.nodeType.name + ")" + wd.getNodePath(anchor.relatedOriginatingNode)
        : ""
    }\n`;
  }
  return s;
}
