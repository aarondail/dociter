import * as DoctarianDocument from "doctarion-document";
import React from "react";

import { EditorContext } from "./EditorContext";

class NodeLayoutProvider implements DoctarianDocument.NodeLayoutProvider {
  public constructor(private element: HTMLElement) {}

  public getCodePointLayout(startOffset?: number, endOffset?: number): DoctarianDocument.LayoutRect[] | undefined {
    const r = new Range();
    r.selectNodeContents(this.element);

    const start = startOffset ?? 0;
    let end;
    if (endOffset !== undefined) {
      end = endOffset;
    } else {
      end = (this.element.textContent?.length || 1) - 1;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const c = this.element.firstChild!;
    const results = [];
    for (let i = start; i <= end; i++) {
      r.setStart(c, i);
      r.setEnd(c, i + 1);
      results.push(r.getBoundingClientRect());
    }
    return results;
  }

  public getLayout() {
    return this.element.getBoundingClientRect();
  }
}

export interface DocumentNodeProps {
  readonly node: DoctarianDocument.Node;
}

export const DocumentNode = React.memo(function DocumentNode({ node }: DocumentNodeProps): JSX.Element | null {
  const editorContext = React.useContext(EditorContext);
  const id = editorContext.ids.getId(node);

  let children: React.ReactNode;
  if (DoctarianDocument.Node.containsText(node)) {
    children = node.text.join("");
  } else if (DoctarianDocument.Node.containsInlineContent(node)) {
    children = node.content.map((n) => <DocumentNode key={editorContext.ids.getId(n)} node={n} />);
  } else {
    // This handles e.g. the Document itself
    children = DoctarianDocument.Node.getChildren(node)?.map((n) => (
      <DocumentNode key={editorContext.ids.getId(n)} node={n} />
    ));
  }

  const providerRef: React.MutableRefObject<NodeLayoutProvider | null> = React.createRef();
  const elementRef = React.useCallback(
    (element: HTMLElement | undefined) => {
      if (!id) {
        return;
      }

      // I sure hope these callbacks get called with null for cleanup...
      if (providerRef.current) {
        editorContext.layout.removeProvider(id, providerRef.current);
        providerRef.current = null;
      }

      if (!element) {
        return;
      }

      const provider = new NodeLayoutProvider(element);
      editorContext.layout.setProvider(id, provider);
      providerRef.current = provider;
    },
    [editorContext.layout, id, providerRef]
  );

  return DoctarianDocument.Node.switch(node, {
    onDocument: (doc) => (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <div id={id} ref={elementRef as any}>
        {children}
      </div>
    ),
    onHeaderBlock: (block) => (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <h1 id={id} ref={elementRef as any}>
        {children}
      </h1>
    ),
    onParagraphBlock: (block) => (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <p id={id} ref={elementRef as any}>
        {children}
      </p>
    ),
    onInlineText: (inline) => (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <span id={id} ref={elementRef as any}>
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
    onCodePoint: (cp) => <span id={id}>{cp}</span>,
  });
});
