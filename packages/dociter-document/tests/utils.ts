/* eslint-disable @typescript-eslint/unbound-method */

import { Chain, Node, NodeNavigator, Path, PathString } from "../src/basic-traversal";
import { CursorAffinity, CursorNavigator } from "../src/cursor";
import { EditorState } from "../src/editor";
import * as Models from "../src/models";

export const doc = (...blocks: readonly Models.Block[]): Models.Document => Models.Document.new("title", ...blocks);
export const header = Models.Block.header;
export const paragraph = Models.Block.paragraph;
export const inlineText = Models.InlineText.new;
export const inlineUrlLink = Models.InlineUrlLink.new;

export const debugPath = (nav: { path: Path }): string => Path.toString(nav.path);

export const debugCursorNavigator = (nav: CursorNavigator): string => {
  const c = nav.cursor;
  const p = Path.toString(c.at);
  if (c.affinity === CursorAffinity.Before) {
    return `<| ` + p;
  } else if (c.affinity === CursorAffinity.After) {
    return p + ` |>`;
  }
  return p;
};

export const DebugEditorHelpers = (() => {
  const debugNodeSolo = (node: Node): string => {
    const modifiersToString = (m?: Partial<Models.TextModifiers>) => {
      if (!m) {
        return "";
      }
      const result = [];
      if (m.bold) {
        result.push("BOLD");
      }
      if (m.italic) {
        result.push("ITALIC");
      }
      if (m.underline) {
        result.push("UNDERLINE");
      }
      if (m.strikethrough) {
        result.push("STRIKETHROUGH");
      }
      if (m.backgroundColor) {
        result.push("BG COLOR: " + m.backgroundColor);
      }
      if (m.foregroundColor) {
        result.push("FG COLOR: " + m.foregroundColor);
      }
      return result.join(",");
    };

    const d = Node.switch(node, {
      onDocument: () => "!DOCUMENT!",
      onHeaderBlock: ({ level }) => `HEADER ${level}`,
      onParagraphBlock: () => `PARAGRAPH`,
      onInlineText: (e) => `TEXT {${modifiersToString(e.modifiers)}}`,
      onInlineUrlLink: ({ url }) => `URL_LINK ${url}`,
      onCodePoint: () => {
        throw new Error("Should never hit this.");
      },
    });

    if (Node.containsText(node)) {
      return d + " > " + `"${node.text.join("")}"`;
    }
    return d;
  };

  const debugElementChainSimple = (chain: Chain): string => {
    if (chain.length === 0) {
      return `!DOCUMENT!`;
    }

    const chunks = [];
    for (const { node } of chain) {
      if (Node.isDocument(node)) {
        continue;
      } else if (Node.isCodePoint(node)) {
        // Code points don't need to be individually written
        break;
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      chunks.push(debugNodeSolo(node));
    }
    return chunks.join(" > ");
  };

  /**
   * This is probably not right for all elements so making it work only for blocks for now.
   */
  const debugBlockSimple = (document: Models.Document, path: PathString): string => {
    const nav = new NodeNavigator(document);
    if (nav.navigateTo(path)) {
      let result = "";
      if (Node.containsInlineContent(nav.tip.node)) {
        if (nav.navigateToFirstChild()) {
          do {
            result += "\n" + debugElementChainSimple(nav.chain);
          } while (nav.navigateToNextSibling());
        }
      }
      return result;
    } else {
      return `
!INVALID PATH!'`;
    }
  };

  const debugEditorStateSimple = (state: EditorState) => {
    const nav = new NodeNavigator(state.document);
    const c = state.cursor;
    if (nav.navigateTo(c.at)) {
      const cursorDebug =
        c.affinity === CursorAffinity.Before
          ? "<| " + (debugPath(nav) || "(EMPTY STRING, AKA THE DOCUMENT)")
          : c.affinity === CursorAffinity.After
          ? (debugPath(nav) || "(EMPTY STRING, AKA THE DOCUMENT)") + " |>"
          : debugPath(nav);
      const elementString = debugElementChainSimple(nav.chain);
      return `
CURSOR: ${cursorDebug}
SLICE:  ${elementString}`;
    } else {
      return `
CURSOR: ?${debugPath(nav) || "(EMPTY STRING, AKA THE DOCUMENT)"}?
SLICE:  !INVALID CURSOR POSITION (probably not a code point or insertion point?)!
DOCUMENT BLOCKS:
${JSON.stringify(state.document.blocks, undefined, 4)}
`;
    }
  };

  return { debugEditorStateSimple, debugBlockSimple };
})();
