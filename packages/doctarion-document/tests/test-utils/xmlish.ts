import * as htmlparser from "htmlparser2";

import {
  Anchor,
  Document,
  DocumentNode,
  FacetDictionary,
  Floater,
  Header,
  Link,
  Node,
  NodeCategory,
  NodeChildrenType,
  NodeType,
  Paragraph,
  Span,
  Text,
  TextStyleModifier,
  TextStyleStrip,
  TextStyleStripEntry,
} from "../../src";
import { Mutable } from "../../src/shared-utils";

/**
 * Create a test Document for the tests.
 *
 * This is so simple that it probably doesn't need to really be a tagged
 * template at this point.
 */
export function testDoc(literals: TemplateStringsArray, ...placeholders: string[]): DocumentNode {
  let result = "";

  // interleave the literals with the placeholders
  for (let i = 0; i < placeholders.length; i++) {
    result += literals[i];
    result += placeholders[i];
  }
  result += literals[literals.length - 1];
  return docFromXmlish(result);
}

const tagToNodeTypes: Record<string, NodeType> = {
  h: Header,
  p: Paragraph,
  s: Span,
  // Note don't change this to "link"... if it is that then the parser assumes
  // these nodes cannot have text contents and will ignore them.
  lnk: Link,
  floater: Floater,
};

const nodeTypesToTag = new Map(Object.entries(tagToNodeTypes).map(([key, value]) => [value, key]));

function docFromXmlish(xmlish: string): DocumentNode {
  const rootKids: Node[] = [];
  const currentStack: { type: NodeType; facets: FacetDictionary; kids: Node[] }[] = [];
  const currentNode = (): { type: NodeType; facets: FacetDictionary; kids: Node[] } | undefined => {
    return currentStack.length > 0 ? currentStack[currentStack.length - 1] : undefined;
  };
  let currentNodeText: string | undefined = undefined;
  const annotations: Node[] = [];

  const parser = new htmlparser.Parser(
    {
      onopentag(name, attributes) {
        const type = tagToNodeTypes[name];
        if (!type) {
          throw new Error(`Could not find NodeType for tag '${name}'`);
        }
        currentStack.push({ type, facets: attributes, kids: [] });
        if (type.childrenType === NodeChildrenType.Text || type.childrenType === NodeChildrenType.FancyText) {
          currentNodeText = "";
        }
      },
      ontext(text) {
        const n = currentNode();
        if (
          n &&
          (n.type.childrenType === NodeChildrenType.Text || n.type.childrenType === NodeChildrenType.FancyText)
        ) {
          currentNodeText = (currentNodeText || "") + text;
        }
      },
      onclosetag(name) {
        const n = currentNode();
        if (n) {
          const type = tagToNodeTypes[name];
          if (!type) {
            throw new Error(`Could not find NodeType for tag '${name}'`);
          } else if (type !== n.type) {
            throw new Error(`Mismatched NodeType at closing tag ${name}`);
          }
          currentStack.pop();
          const kidsArray = currentNode()?.kids || rootKids;

          // Fill in default facets
          const f = n.facets as any;
          if (n.type === Span && f.styles) {
            f.styles = textStyleStripFromXmlish(f.styles);
          }
          if (f.anchor) {
            const [orientation, anchorRest] = f.anchor.split(" ");
            let path = anchorRest;
            let graphemeIndex;
            if (anchorRest.includes("⁙")) {
              const x = anchorRest.split("⁙");
              path = x[0];
              graphemeIndex = parseInt(x[1], 10);
            }
            let nodeAtPath: Node | undefined = undefined;
            for (const p of path.split("/")) {
              const pIndex = parseInt(p, 10);
              if (nodeAtPath) {
                nodeAtPath = nodeAtPath.children[pIndex] as any;
              } else {
                nodeAtPath = rootKids[pIndex];
              }
            }
            f.anchor = new Anchor(nodeAtPath!, orientation, graphemeIndex);
          }

          const newNode = new Node(
            n.type,
            currentNodeText !== undefined ? Text.fromString(currentNodeText) : n.kids,
            f
          );
          if (type.category === NodeCategory.Annotation) {
            annotations.push(newNode);
          } else {
            kidsArray.push(newNode);
          }
        }
        currentNodeText = undefined;
      },
    },
    { recognizeSelfClosing: true }
  );

  parser.parseComplete(xmlish);

  return new Node(Document, rootKids, { laterals: [], annotations });
}

export function nodeToXmlish(node: Node, { includeIds }: { includeIds?: boolean } = {}): string {
  const padAndAddNewline = (text: string, indentation: number) => {
    let s = "";
    for (let i = 0; i < indentation; i++) {
      s += " ";
    }
    s += text + "\n";
    return s;
  };

  const nodeToXmlPrime = (n: Node, indentation: number) => {
    let s = "";
    const tag = nodeTypesToTag.get(n.nodeType);
    if (!tag) {
      throw new Error(`Could not find tag for NodeType ${n.nodeType.name}`);
    }

    const attributes = n.facets as any;

    if (includeIds && (n as any).id) {
      attributes.id = (n as any).id;
    }

    let attributesString = "";
    if (Object.values(attributes).length > 0) {
      for (const key of Object.keys(attributes).sort()) {
        let value = attributes[key];
        if (value instanceof TextStyleStrip) {
          if (value.entries.length === 0) {
            continue;
          }
          value = textStyleStripToXmlish(value);
        }

        attributesString += ` ${key}=${value}`;
      }
    }

    const startTag = `<${tag}${attributesString}>`;
    if (n.nodeType.childrenType === NodeChildrenType.FancyText || n.nodeType.childrenType === NodeChildrenType.Text) {
      s += padAndAddNewline(`${startTag}${Text.toString(n.children as Text)}</${tag}>`, indentation);
    } else if (n.nodeType.childrenType === NodeChildrenType.Inlines) {
      let kidString = "";
      for (const k of n.children) {
        kidString += nodeToXmlPrime(k as any, 0);
      }
      kidString = kidString.split("\n").join(" ");
      s += padAndAddNewline(`${startTag} ${kidString}</${tag}>`, indentation);
    } else {
      s += padAndAddNewline(startTag, indentation);
      for (const k of n.children) {
        s += nodeToXmlPrime(k as any, indentation + 2);
      }
      s += padAndAddNewline(`</${tag}>`, indentation);
    }
    return s;
  };

  const r = nodeToXmlPrime(node, 0);
  if (r.endsWith("\n")) {
    return r.slice(0, r.length - 1);
  }
  return r;
}

export function docToXmlish(doc: DocumentNode, { includeIds }: { includeIds?: boolean } = {}): string {
  // Skip document
  return doc.children.map((x) => nodeToXmlish(x, { includeIds })).join("\n");
}

function modifierStringToModifiers(s: string) {
  const m: Mutable<TextStyleModifier> = {};
  for (let i = 0; i < s.length; i += 2) {
    const change = s[i] === "+" ? true : null;
    const x = s[i + 1];
    switch (x) {
      case "B":
        m.bold = change;
        break;
      default:
        throw new Error(`Unknown TextStyleModifier ${x}`);
    }
  }
  return m;
}

function modifierStringFromModifiers(m: TextStyleModifier): string {
  let s = "";
  for (const k of Object.keys(m)) {
    if (k === "bold") {
      s += (m[k] === null ? "-" : "+") + "B";
    } else {
      throw new Error(`Unknown TextStyleModifier ${k}`);
    }
  }
  return s;
}

function textStyleStripFromXmlish(s: string): TextStyleStrip {
  const entries: TextStyleStripEntry[] = [];

  for (const e of s.split(",")) {
    const [charIndex, modifiers] = e.split(":");
    const index = parseInt(charIndex, 10);
    entries.push({
      graphemeIndex: index,
      modifier: modifierStringToModifiers(modifiers),
    });
  }

  return new TextStyleStrip(...entries);
}

function textStyleStripToXmlish(strip: TextStyleStrip): string {
  const s = [];
  for (const e of strip.entries) {
    s.push(`${e.graphemeIndex}:${modifierStringFromModifiers(e.modifier)}`);
  }
  return s.join(",");
}
