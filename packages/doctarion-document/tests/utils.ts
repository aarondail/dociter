/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import lodash from "lodash";

import { Chain, NodeNavigator, Path, PathString } from "../src/basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation } from "../src/cursor";
import { Editor } from "../src/editor";
import { SimpleComparison } from "../src/miscUtils";
import {
  Block,
  Document,
  HeaderBlock,
  InlineEmoji,
  InlineText,
  InlineUrlLink,
  Node,
  NodeUtils,
  ObjectNode,
  ParagraphBlock,
  Text,
  TextModifiers,
} from "../src/models";
import {
  Anchor,
  Interactor,
  InteractorAnchorType,
  InteractorId,
  InteractorStatus,
  NodeAssociatedData,
  ReadonlyWorkingDocument,
} from "../src/working-document";

export const doc = (...blocks: readonly Block[]): Document => new Document("title", ...blocks);
export const header = (...args: any[]) => new HeaderBlock(...args);
export const paragraph = (...args: any[]) => new ParagraphBlock(...args);
export const inlineText = (text: string | Text, modifiers?: Partial<TextModifiers>) => new InlineText(text, modifiers);
export const inlineUrlLink = (url: string, text: string | Text) => new InlineUrlLink(url, text);
export const inlineEmoji = (emoji: string) => new InlineEmoji(emoji);

export const debugPath = (nav: { path: Path }): string => nav.path.toString();

export const debugCursorNavigator = (nav: CursorNavigator): string => {
  const c = nav.cursor;
  const p = c.path.toString();
  if (c.orientation === CursorOrientation.Before) {
    return `<| ` + p;
  } else if (c.orientation === CursorOrientation.After) {
    return p + ` |>`;
  }
  return p;
};

export const debugCursorNavigator2 = (nav: CursorNavigator): string => {
  const n = nav.tip.node;
  return debugCursorNavigator(nav) + " :: " + (NodeUtils.isGrapheme(n) ? n : DebugEditorHelpers.debugSoloNode(n));
};

export const DebugEditorHelpers = (() => {
  const debugSoloNode = (node: Node): string => {
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
      onInlineEmoji: ({ emojiId }) => `EMOJI ${emojiId}`,
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
      chunks.push(debugSoloNode(node));
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

  const debugCursor = (
    anchor: Anchor | undefined,
    testingNavigator: NodeNavigator,
    workingDocument: ReadonlyWorkingDocument,
    editor: Editor
  ): { cursorDebug: string; chain: Chain | undefined; cursor: Cursor | undefined } => {
    const cursor = anchor && editor.anchorToCursor(anchor);
    if (cursor && testingNavigator.navigateTo(cursor.path)) {
      const cursorDebug =
        cursor.orientation === CursorOrientation.Before
          ? "<| " + (debugPath(testingNavigator) || "(EMPTY STRING, AKA THE DOCUMENT)")
          : cursor.orientation === CursorOrientation.After
          ? (debugPath(testingNavigator) || "(EMPTY STRING, AKA THE DOCUMENT)") + " |>"
          : debugPath(testingNavigator);

      return { cursorDebug, chain: testingNavigator.chain, cursor };
    } else {
      return {
        cursorDebug: `?${debugPath(testingNavigator) || "(EMPTY STRING, AKA THE DOCUMENT)"}?`,
        chain: undefined,
        cursor: undefined,
      };
    }
  };

  const debugInteractors = (editor: Editor) => {
    const nav = new NodeNavigator(editor.state.document);

    const interactors = lodash.sortBy(editor.state.getAllInteractors(), (i) => i.name);
    return interactors
      .map((i, index) => {
        const a = i.getAnchor(InteractorAnchorType.Main);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const c = debugCursor(editor.state.getAnchor(a!), nav, editor.state, editor);
        const cursorDebug = c.cursorDebug;

        let saCursorDebug;
        let mainFirst = false;
        if (i.isSelection) {
          const sa = i.getAnchor(InteractorAnchorType.SelectionAnchor);
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const saC = debugCursor(editor.state.getAnchor(sa!), nav, editor.state, editor);
          saCursorDebug = saC.cursorDebug;
          mainFirst = !!(c.cursor && saC.cursor && c.cursor.compareTo(saC.cursor) !== SimpleComparison.After);
        }

        const f = editor.state.focusedInteractor === i;
        const s =
          f || i.status === InteractorStatus.Inactive
            ? `(${f ? "F" : ""}${i.status === InteractorStatus.Inactive ? "I" : ""}) `
            : "";
        return `${i.name ?? `(no-name, #${index + 1})`} ${s}${
          i.isSelection
            ? mainFirst
              ? `${cursorDebug} ◉◀◀◀ ${saCursorDebug || ""}`
              : `${saCursorDebug || ""} ▶▶▶◉ ${cursorDebug || ""}`
            : cursorDebug
        }`;
      })
      .join(", ");
  };

  const debugEditorStateForInteractor = (editor: Editor, interactor: Interactor, description?: string) => {
    const nav = new NodeNavigator(editor.state.document);
    if (interactor.isSelection) {
      const { cursorDebug: cursorDebug1, chain: chain1 } = debugCursor(
        editor.state.getAnchor(interactor.mainAnchor),
        nav,
        editor.state,
        editor
      );
      const { cursorDebug: cursorDebug2, chain: chain2 } = debugCursor(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        editor.state.getAnchor(interactor.selectionAnchor!),
        nav,
        editor.state,
        editor
      );
      let s1 = "";
      if (chain1) {
        const elementString = debugElementChainSimple(chain1);
        s1 = `${description || ""}
MAIN CURSOR: ${cursorDebug1}
SLICE:  ${elementString}`;
      } else {
        s1 = `${description || ""}
MAIN CURSOR: ${cursorDebug1}
SLICE:  !INVALID CURSOR POSITION!
DOCUMENT BLOCKS:
${JSON.stringify(editor.state.document.children, undefined, 4)}
`;
      }

      let s2 = "";
      if (chain2) {
        const elementString = debugElementChainSimple(chain2);
        s2 = `${description || ""}
S.A. CURSOR: ${cursorDebug2}
SLICE:  ${elementString}`;
      } else {
        s2 = `${description || ""}
S.A. CURSOR: ${cursorDebug2}
SLICE:  !INVALID CURSOR POSITION!
DOCUMENT BLOCKS:
${JSON.stringify(editor.state.document.children, undefined, 4)}
`;
      }

      return s1 + s2;
    } else {
      const { cursorDebug, chain } = debugCursor(
        editor.state.getAnchor(interactor.mainAnchor),
        nav,
        editor.state,
        editor
      );
      if (chain) {
        const elementString = debugElementChainSimple(chain);
        return `${description || ""}
CURSOR: ${cursorDebug}
SLICE:  ${elementString}`;
      } else {
        return `${description || ""}
CURSOR: ${cursorDebug}
SLICE:  !INVALID CURSOR POSITION!
DOCUMENT BLOCKS:
${JSON.stringify(editor.state.document.children, undefined, 4)}
`;
      }
    }
  };

  const debugEditorStateSimple = (editor: Editor) => {
    if (!editor.state.focusedInteractor) {
      throw new Error("There is no focused interactor.");
    }
    return debugEditorStateForInteractor(editor, editor.state.focusedInteractor);
  };

  const debugEditorStateLessSimple = (editor: Editor) => {
    return editor.state
      .getAllInteractors()
      .map((i, index) => {
        return debugEditorStateForInteractor(
          editor,
          i,
          // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
          "\nINTR. " + (i.name ? i.name : "#" + (index + 1))
        );
      })
      .join("\n");
  };

  const debugBlockAtInteractor = (editor: Editor, interactorId: InteractorId): string => {
    const i = editor.state.getAllInteractors().find((x) => x.id === interactorId);
    const mainCursor = editor.anchorToCursor(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      editor.state.getAnchor(i!.mainAnchor)!
    );
    if (!mainCursor) {
      throw Error("Could not convert main anchor into cursor");
    }
    const selectionAnchorCursor =
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      i!.selectionAnchor &&
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      editor.anchorToCursor(editor.state.getAnchor(i!.selectionAnchor)!);
    if (selectionAnchorCursor) {
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      const path1 = "" + mainCursor.path?.parts[0].index;
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands, @typescript-eslint/no-non-null-assertion
      const path2 = "" + selectionAnchorCursor.path?.parts[0].index;
      return (
        "\nMAIN CURSOR:" +
        debugBlockSimple(editor.state.document, path1) +
        "\nS.A. CURSOR:" +
        debugBlockSimple(editor.state.document, path2)
      );
    } else {
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      const path = "" + mainCursor.path?.parts[0].index;
      return debugBlockSimple(editor.state.document, path);
    }
  };

  const debugCurrentBlock = (editor: Editor): string => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const i = editor.state.focusedInteractor!;
    const c = i.mainAnchor;
    if (!c) {
      throw new Error("There is no focused interactor.");
    }
    return debugBlockAtInteractor(editor, i.id);
  };

  return {
    debugInteractors,
    debugSoloNode,
    debugEditorStateSimple,
    debugEditorStateLessSimple,
    debugCurrentBlock,
    debugBlockSimple,
  };
})();

export function nodeToXml(node: ObjectNode, includeIds?: boolean): string {
  const p = (s2: string, ind: number) => {
    let s = "";
    for (let i = 0; i < ind; i++) {
      s += " ";
    }
    s += s2;
    s += "\n";
    return s;
  };

  const debugPrime = (node: ObjectNode, ind: number) => {
    let s = "";
    if (includeIds) {
      s += p(`<${NodeAssociatedData.getId(node)} parent=${NodeAssociatedData.getParentId(node)}>`, ind);
    } else {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      if (NodeUtils.isTextContainer(node)) {
        s += p(`<${node.kind}>${Text.toString(node.children)}</${node.kind}`, ind);
        return s;
      } else {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        s += p(`<${node.kind}>`, ind);
      }
    }
    if (NodeUtils.isTextContainer(node)) {
      s += p(Text.toString(node.children), ind + 2);
    } else {
      for (const k of NodeUtils.getChildren(node) || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        s += debugPrime(k as any, ind + 2);
      }
    }
    if (includeIds) {
      s += p(`</${NodeAssociatedData.getId(node)}>`, ind);
    } else {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      s += p(`</${node.kind}>`, ind);
    }
    return s;
  };

  return debugPrime(node, 0);
}
