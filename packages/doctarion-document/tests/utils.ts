/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { Chain, NodeNavigator, Path, PathString } from "../src/basic-traversal";
import { Cursor, CursorNavigator, CursorOrientation } from "../src/cursor";
import { Editor, EditorState } from "../src/editor";
import { InteractorOrderingEntryCursorType, InteractorStatus } from "../src/editor/interactor";
import {
  Block,
  Document,
  HeaderBlock,
  InlineEmoji,
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
    cursor: Cursor,
    testingNavigator: NodeNavigator
  ): { cursorDebug: string; chain: Chain | undefined } => {
    if (testingNavigator.navigateTo(cursor.path)) {
      const cursorDebug =
        cursor.orientation === CursorOrientation.Before
          ? "<| " + (debugPath(testingNavigator) || "(EMPTY STRING, AKA THE DOCUMENT)")
          : cursor.orientation === CursorOrientation.After
          ? (debugPath(testingNavigator) || "(EMPTY STRING, AKA THE DOCUMENT)") + " |>"
          : debugPath(testingNavigator);

      return { cursorDebug, chain: testingNavigator.chain };
    } else {
      return {
        cursorDebug: `?${debugPath(testingNavigator) || "(EMPTY STRING, AKA THE DOCUMENT)"}?`,
        chain: undefined,
      };
    }
  };

  const debugInteractorOrdering = (editor: Editor) => {
    const nav = new NodeNavigator(editor.document);

    const realIdToFakeIdMap = new Map<string, number>();
    return editor.interactorOrdering
      .map(({ id, cursor }) => {
        let fakeId: number;
        if (realIdToFakeIdMap.has(id)) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          fakeId = realIdToFakeIdMap.get(id)!;
        } else {
          fakeId = realIdToFakeIdMap.size + 1;
          realIdToFakeIdMap.set(id, fakeId);
        }
        const interactor = editor.interactors[id];

        const c = debugCursor(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          cursor === InteractorOrderingEntryCursorType.Main ? interactor.mainCursor : interactor.selectionAnchorCursor!,
          nav
        ).cursorDebug;
        const f = editor.focusedInteractor === interactor;
        const s =
          f || interactor.status === InteractorStatus.Inactive
            ? `(${f ? "F" : ""}${interactor.status === InteractorStatus.Inactive ? "I" : ""}) `
            : "";
        return `${fakeId}.${cursor === InteractorOrderingEntryCursorType.Main ? "M" : "Sa"} ${s}${c}`;
      })
      .join(", ");
  };

  const debugEditorStateSimple = (editor: Editor) => {
    const nav = new NodeNavigator(editor.document);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const c = editor.focusedInteractor?.mainCursor;
    if (!c) {
      throw new Error("There is no focused interactor.");
    }
    if (editor.focusedInteractor?.isSelection) {
      throw new Error("The focused interactor is a selection.");
    }
    const { cursorDebug, chain } = debugCursor(c, nav);
    if (chain) {
      const elementString = debugElementChainSimple(chain);
      return `
CURSOR: ${cursorDebug}
SLICE:  ${elementString}`;
    } else {
      return `
CURSOR: ${cursorDebug}
SLICE:  !INVALID CURSOR POSITION (probably not a grapheme or insertion point?)!
DOCUMENT BLOCKS:
${JSON.stringify(editor.document.children, undefined, 4)}
`;
    }
  };

  const debugCurrentBlock = (editor: Editor | EditorState): string => {
    const i =
      editor instanceof Editor
        ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          editor.focusedInteractor!
        : editor.interactors[editor.focusedInteractorId as string];
    const c = i.mainCursor;
    if (!c) {
      throw new Error("There is no focused interactor.");
    }
    if (i.isSelection) {
      throw new Error("The focused interactor is a selection.");
    }
    const prePath = c.path;
    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    const path = "" + prePath?.parts[0].index;
    return debugBlockSimple(editor.document, path);
  };

  return { debugSoloNode, debugInteractorOrdering, debugEditorStateSimple, debugCurrentBlock };
})();
