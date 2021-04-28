/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { Chain, NodeNavigator, Path, PathString } from "../src/basic-traversal";
import { Cursor, CursorAffinity, CursorNavigator } from "../src/cursor";
import { Editor, EditorState } from "../src/editor";
import {
  Block,
  Document,
  HeaderBlock,
  InlineText,
  InlineUrlLink,
  Node,
  NodeUtils,
  ParagraphBlock,
  Text,
  TextModifiers,
} from "../src/models";

export const doc = (...blocks: readonly Block[]): Document => new Document("title", ...blocks);
export const header = (...args: any[]) => new HeaderBlock(...args);
export const paragraph = (...args: any[]) => new ParagraphBlock(...args);
export const inlineText = (text: string | Text, modifiers?: Partial<TextModifiers>) => new InlineText(text, modifiers);
export const inlineUrlLink = (url: string, text: string | Text) => new InlineUrlLink(url, text);

export const debugPath = (nav: { path: Path }): string => nav.path.toString();

export const debugCursorNavigator = (nav: CursorNavigator): string => {
  const c = nav.cursor;
  const p = c.at.toString();
  if (c.affinity === CursorAffinity.Before) {
    return `<| ` + p;
  } else if (c.affinity === CursorAffinity.After) {
    return p + ` |>`;
  }
  return p;
};

export const DebugEditorHelpers = (() => {
  const debugNodeSolo = (node: Node): string => {
    const modifiersToString = (m?: Partial<TextModifiers>) => {
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

    const d = NodeUtils.switch(node, {
      onDocument: () => "!DOCUMENT!",
      onHeaderBlock: ({ level }) => `HEADER ${level}`,
      onParagraphBlock: () => `PARAGRAPH`,
      onInlineText: (e) => `TEXT {${modifiersToString(e.modifiers)}}`,
      onInlineUrlLink: ({ url }) => `URL_LINK ${url}`,
      onGrapheme: () => {
        throw new Error("Should never hit this.");
      },
    });

    if (NodeUtils.isTextContainer(node)) {
      return d + " > " + `"${node.text.join("")}"`;
    }
    return d;
  };

  const debugElementChainSimple = (chain: Chain): string => {
    if (chain.length === 0) {
      return `!DOCUMENT!`;
    }

    const chunks = [];
    for (const { node } of chain.links) {
      if (node instanceof Document) {
        continue;
      } else if (NodeUtils.isGrapheme(node)) {
        // Graphemes don't need to be individually written
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
  const debugBlockSimple = (document: Document, path: PathString): string => {
    const nav = new NodeNavigator(document);
    if (nav.navigateTo(path)) {
      let result = "";
      if (NodeUtils.isInlineContainer(nav.tip.node)) {
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

  const debugEditorStateSimple = (state: { document: Document; cursor: Cursor }) => {
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
SLICE:  !INVALID CURSOR POSITION (probably not a grapheme or insertion point?)!
DOCUMENT BLOCKS:
${JSON.stringify(state.document.children, undefined, 4)}
`;
    }
  };

  const debugCurrentBlock = (editor: Editor | EditorState): string => {
    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    const path = "" + editor.cursor.at?.parts[0].index;
    //   case DocumentInteractionLocationKind.SELECTION:
    //     path += editor.interloc.selection?.[0][0][1];
    //     break;
    // }
    return debugBlockSimple(editor.document, path);
  };

  return { debugEditorStateSimple, debugCurrentBlock };
})();
