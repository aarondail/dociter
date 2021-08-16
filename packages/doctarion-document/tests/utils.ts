/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { Chain, NodeNavigator, Path, PathString } from "../src/basic-traversal";
import { CursorNavigator, CursorOrientation } from "../src/cursor";
import { Anchor, Editor, EditorServices, Interactor, InteractorAnchorType, InteractorId } from "../src/editor";
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
    anchor: Anchor | undefined,
    testingNavigator: NodeNavigator,
    services: EditorServices
  ): { cursorDebug: string; chain: Chain | undefined } => {
    const cursor = anchor?.toCursor(services);
    if (cursor && testingNavigator.navigateTo(cursor.path)) {
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
    return Object.values(editor.interactors)
      .map((iPrime) => {
        const id = iPrime.id;
        let fakeId: number;
        if (realIdToFakeIdMap.has(id)) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          fakeId = realIdToFakeIdMap.get(id)!;
        } else {
          fakeId = realIdToFakeIdMap.size + 1;
          realIdToFakeIdMap.set(id, fakeId);
        }
        const interactor = editor.interactors[id];

        // TODO fix this up
        const a = interactor.getAnchor(InteractorAnchorType.Main);
        const c = debugCursor(a, nav, editor.services).cursorDebug;
        // const f = editor.focusedInteractor === interactor;
        // const s =
        //   f || interactor.status === InteractorStatus.Inactive
        //     ? `(${f ? "F" : ""}${interactor.status === InteractorStatus.Inactive ? "I" : ""}) `
        //     : "";
        // return `${fakeId}.${cursorType === InteractorAnchorType.Main ? "M" : "Sa"} ${s}${c}`;
        return `${fakeId}.${"M"} ${c}`;
      })
      .join(", ");
  };

  const debugEditorStateForInteractor = (editor: Editor, interactor: Interactor, description?: string) => {
    const nav = new NodeNavigator(editor.document);
    if (interactor.isSelection) {
      const { cursorDebug: cursorDebug1, chain: chain1 } = debugCursor(interactor.mainAnchor, nav, editor.services);
      const { cursorDebug: cursorDebug2, chain: chain2 } = debugCursor(
        interactor.selectionAnchor,
        nav,
        editor.services
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
${JSON.stringify(editor.document.children, undefined, 4)}
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
${JSON.stringify(editor.document.children, undefined, 4)}
`;
      }

      return s1 + s2;
    } else {
      const { cursorDebug, chain } = debugCursor(interactor.mainAnchor, nav, editor.services);
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
${JSON.stringify(editor.document.children, undefined, 4)}
`;
      }
    }
  };

  const debugEditorStateSimple = (editor: Editor) => {
    if (!editor.focusedInteractor) {
      throw new Error("There is no focused interactor.");
    }
    return debugEditorStateForInteractor(editor, editor.focusedInteractor);
  };

  const debugEditorStateLessSimple = (editor: Editor) => {
    return Object.values(editor.interactors)
      .map((i, index) => {
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        return debugEditorStateForInteractor(editor, editor.interactors[i.id], "INTR. #" + (index + 1));
      })
      .join("\n");
  };

  const debugBlockAtInteractor = (editor: Editor, interactorId: InteractorId): string => {
    const i = editor.interactors[interactorId];
    const mainCursor = i.mainAnchor.toCursor(editor.services);
    if (!mainCursor) {
      throw Error("Could not convert main anchor into cursor");
    }
    const selectionAnchorCursor = i.selectionAnchor?.toCursor(editor.services);
    if (selectionAnchorCursor) {
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      const path1 = "" + mainCursor.path?.parts[0].index;
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands, @typescript-eslint/no-non-null-assertion
      const path2 = "" + selectionAnchorCursor.path?.parts[0].index;
      return (
        "\nMAIN CURSOR:" +
        debugBlockSimple(editor.document, path1) +
        "\nS.A. CURSOR:" +
        debugBlockSimple(editor.document, path2)
      );
    } else {
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      const path = "" + mainCursor.path?.parts[0].index;
      return debugBlockSimple(editor.document, path);
    }
  };

  const debugCurrentBlock = (editor: Editor): string => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const i = editor.focusedInteractor!;
    const c = i.mainAnchor;
    if (!c) {
      throw new Error("There is no focused interactor.");
    }
    return debugBlockAtInteractor(editor, i.id);
  };

  return {
    debugSoloNode,
    debugInteractorOrdering,
    debugEditorStateSimple,
    debugEditorStateLessSimple,
    debugCurrentBlock,
    debugBlockAtInteractor,
    debugBlockSimple,
  };
})();
