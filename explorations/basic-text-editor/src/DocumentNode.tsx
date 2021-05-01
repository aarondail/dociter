import { NodeLayoutProvider, adjustRect } from "doctarion-browser-utils";
import * as DoctarionDocument from "doctarion-document";
import React from "react";

import { EditorContext } from "./EditorContext";

export class DocumentNodeLayoutProvider extends NodeLayoutProvider {
  private debugElements?: HTMLElement[];
  private privateDebugMode = false;

  public constructor(public element?: HTMLElement, public node?: DoctarionDocument.Node) {
    super(element, node);
  }

  public set debugMode(value: boolean) {
    if (!this.element || !this.node) {
      return;
    }

    if (this.privateDebugMode && !value) {
      if (this.debugElements) {
        this.debugElements.forEach((x) => this.element?.removeChild(x));
      }
      this.debugElements = undefined;
    } else if (!this.privateDebugMode && value) {
      const rects = this.element.getClientRects();
      const divs = [];

      for (const rawRect of rects) {
        const rect = adjustRect(rawRect);
        const div = document.createElement("div");
        div.style.cssText = `position: absolute; pointer-events: none; left: ${rect.left}px; width: ${rect.width}px; top: ${rect.top}px; height: ${rect.height}px; border: solid 1px red;`;
        divs.push(div);
        this.element.appendChild(div);
      }

      this.debugElements = divs;
    }
    this.privateDebugMode = value;
  }
}

export interface DocumentNodeProps {
  readonly node: DoctarionDocument.Node;
}

export const DocumentNode = React.memo(function DocumentNode({ node }: DocumentNodeProps): JSX.Element | null {
  const editorContext = React.useContext(EditorContext);
  const id = DoctarionDocument.NodeId.getId(node);

  let children: React.ReactNode;
  if (DoctarionDocument.NodeUtils.isTextContainer(node)) {
    children = node.text.join("");
  } else if (DoctarionDocument.NodeUtils.isInlineContainer(node)) {
    children = node.children.map((n) => <DocumentNode key={DoctarionDocument.NodeId.getId(n)} node={n} />);
  } else {
    // This handles e.g. the Document itself
    children = DoctarionDocument.NodeUtils.getChildren(node)?.map((n) => (
      <DocumentNode key={DoctarionDocument.NodeId.getId(n)} node={n} />
    ));
  }

  const providerRef: React.MutableRefObject<DocumentNodeLayoutProvider | null> = React.createRef();
  if (!providerRef.current) {
    providerRef.current = new DocumentNodeLayoutProvider();
  }

  // Always update the node
  providerRef.current.node = node;

  const elementRef = React.useCallback(
    (element: HTMLElement | undefined) => {
      if (!id) {
        return;
      }

      // I sure hope these callbacks get called with null for cleanup...
      if (providerRef.current?.element) {
        editorContext.layoutProviderRegistry.removeProvider(id, providerRef.current);
        providerRef.current.element = undefined;
      }

      if (!element) {
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      providerRef.current!.element = element;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      editorContext.layoutProviderRegistry.setProvider(id, providerRef.current!);
    },
    [editorContext.layoutProviderRegistry, id, providerRef]
  );

  return DoctarionDocument.NodeUtils.switch(node, {
    onDocument: (doc) => (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <div id={id} ref={elementRef as any}>
        {children}
      </div>
    ),
    onHeaderBlock: (block) =>
      block.level === DoctarionDocument.HeaderLevel.One ? (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <h1 id={id} ref={elementRef as any}>
          {children}
        </h1>
      ) : block.level === DoctarionDocument.HeaderLevel.Two ? (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <h2 id={id} ref={elementRef as any}>
          {children}
        </h2>
      ) : (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <h3 id={id} ref={elementRef as any}>
          {children}
        </h3>
      ),
    onParagraphBlock: (block) => (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <p id={id} ref={elementRef as any}>
        {children}
      </p>
    ),
    onInlineText: (inline) => (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <span id={id} ref={elementRef as any} style={getStyleForInline(inline)}>
        {children}
      </span>
    ),
    onInlineUrlLink: (inline) => (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <a id={id} ref={elementRef as any} href={inline.url}>
        {children}
      </a>
    ),
    // We never really expect to be rendering a code point like this, because
    // the parent node, e.g. InlineText, will join all the code points into a
    // single string and render that. But, JIC we do this.
    onGrapheme: (cp) => <span id={id}>{cp}</span>,
  });
});

const getStyleForInline = (inline: DoctarionDocument.InlineText) => {
  const m = inline.modifiers;
  if (!m) {
    return undefined;
  }
  const result: React.CSSProperties = {
    backgroundColor: m.backgroundColor,
    color: m.foregroundColor,
    fontWeight: m.bold ? "bold" : undefined,
    fontStyle: m.italic ? "italic" : undefined,
  };
  if (m.strikethrough && m.underline) {
    result.textDecoration = "line-through underline";
  } else if (m.strikethrough) {
    result.textDecoration = "line-through";
  } else if (m.underline) {
    result.textDecoration = "underline";
  }
  return result;
};
