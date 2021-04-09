import * as DoctarionDocument from "doctarion-document";
import { LayoutRect } from "doctarion-document";
import React from "react";

import { EditorContext } from "./EditorContext";

export class DocumentNodeLayoutProvider implements DoctarionDocument.NodeLayoutProvider {
  public constructor(private element: HTMLElement) {}

  /**
   * This is very similar to the below method for code points but, but instead
   * works for nodes that have other types of children (not code points).
   *
   * Also, unlike the code points method, it can return multiple records for a
   * single node. For example an inline that is split across two different
   * lines.
   */
  public getChildNodeLayouts(
    startOffset?: number,
    endOffset?: number
  ): [DoctarionDocument.NodeId, DoctarionDocument.LayoutRect[]][] {
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
    const results: [DoctarionDocument.NodeId, DoctarionDocument.LayoutRect[]][] = [];
    for (let i = start; i <= end; i++) {
      r.setStart(c, i);
      r.setEnd(c, i + 1);
      const nodeId = (r.startContainer as HTMLElement).id;
      if (nodeId) {
        results.push([nodeId, [...r.getClientRects()].map(this.adjustRect)]);
      }
    }
    return results;
  }

  public getCodePointLayout(startOffset?: number, endOffset?: number): DoctarionDocument.LayoutRect[] | undefined {
    // console.log(`DocumentNode::getCodePointLayout(${startOffset || ""}, ${endOffset || ""}})`);

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
      // console.log("Range contents: ", r.cloneContents(), r.getClientRects().length);
      // Sometimes (with line wrapping, a code point will have multiple rects.
      // Using getBoundingClientRect inflates to cover the entire pair of lines)
      //
      // We use the second rect since that is probably the one we want...
      const rects = r.getClientRects();
      // console.log("DocumentNode::getCodePointLayout rect count = ", rects.length, rects);
      if (rects.length === 1) {
        results.push(this.adjustRect(rects[0]));
      } else if (rects.length === 2) {
        results.push(this.adjustRect(rects[1]));
      } else {
        throw new Error("Unexpected number of rects when getting a code point's layout.");
      }
    }
    return results;
  }

  public getLayout(): LayoutRect {
    // console.log("DocumentNode::getLayout()");
    return this.adjustRect(this.element.getBoundingClientRect());
  }

  private adjustRect(rect: ClientRect): LayoutRect {
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    return {
      top: rect.top + scrollTop,
      bottom: rect.bottom + scrollTop,
      left: rect.left + scrollLeft,
      right: rect.right + scrollLeft,
      height: rect.height,
      width: rect.width,
    };
  }
}

export interface DocumentNodeProps {
  readonly node: DoctarionDocument.Node;
}

export const DocumentNode = React.memo(function DocumentNode({ node }: DocumentNodeProps): JSX.Element | null {
  const editorContext = React.useContext(EditorContext);
  const id = DoctarionDocument.Node.getId(node);

  let children: React.ReactNode;
  if (DoctarionDocument.Node.containsText(node)) {
    children = node.text.join("");
  } else if (DoctarionDocument.Node.containsInlineContent(node)) {
    children = node.content.map((n) => <DocumentNode key={DoctarionDocument.Node.getId(n)} node={n} />);
  } else {
    // This handles e.g. the Document itself
    children = DoctarionDocument.Node.getChildren(node)?.map((n) => (
      <DocumentNode key={DoctarionDocument.Node.getId(n)} node={n} />
    ));
  }

  const providerRef: React.MutableRefObject<DocumentNodeLayoutProvider | null> = React.createRef();
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

      const provider = new DocumentNodeLayoutProvider(element);
      editorContext.layout.setProvider(id, provider);
      providerRef.current = provider;
    },
    [editorContext.layout, id, providerRef]
  );

  return DoctarionDocument.Node.switch(node, {
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
