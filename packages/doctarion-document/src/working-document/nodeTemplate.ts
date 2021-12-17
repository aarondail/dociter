import {
  FacetDictionary,
  FacetTypeConvenienceDictionary,
  Node,
  NodeChildrenTypeToActualType,
  NodeType,
  NodeTypeDescription,
} from "../document-model";

export class NodeTemplate<SpecificNodeTypeDescription extends NodeTypeDescription = NodeTypeDescription> {
  public constructor(
    public readonly nodeType: NodeType<SpecificNodeTypeDescription>,
    public readonly facets: SpecificNodeTypeDescription["facets"] extends FacetTypeConvenienceDictionary
      ? FacetDictionary<SpecificNodeTypeDescription["facets"]>
      : // eslint-disable-next-line @typescript-eslint/ban-types
        {}
  ) {}

  public instantiate(
    children: NodeChildrenTypeToActualType<SpecificNodeTypeDescription["childrenType"]>
  ): Node<SpecificNodeTypeDescription> {
    return new Node(this.nodeType, children, this.facets);
  }
}
