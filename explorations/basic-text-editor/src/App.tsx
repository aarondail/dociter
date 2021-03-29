import * as DoctarionDocument from "doctarion-document";
import React, { useEffect, useLayoutEffect } from "react";
import { useCallbackRef } from "use-callback-ref";

import { CursorManager } from "./CursorManager";
import { DocumentNode } from "./DocumentNode";
import { EditorContext } from "./EditorContext";
import { KeyInterpreter } from "./KeyInterpreter";

import "./App.css";

enum InputMode {
  Command,
  Insert,
}
function App(): JSX.Element {
  const [doc /*, setDoc*/] = React.useState(
    DoctarionDocument.Document.new(
      "A",
      // DD.Block.paragraph(DD.InlineText.new(SAMPLE)),
      // DD.Block.paragraph(DD.InlineText.new("ThisissometextinaparagrapThisissometextinaparagraph")),
      DoctarionDocument.Block.paragraph(DoctarionDocument.InlineText.new("This is some text in a paragraph")),
      DoctarionDocument.Block.paragraph(DoctarionDocument.InlineText.new("This is more text in a second paragraph"))
    )
  );
  const [editorMode, setEditorMode] = React.useState(InputMode.Command);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef: React.MutableRefObject<DoctarionDocument.Editor> = React.useRef<DoctarionDocument.Editor>() as any;
  if (!editorRef.current) {
    editorRef.current = new DoctarionDocument.Editor(doc);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keyInterpreterRef: React.MutableRefObject<KeyInterpreter> = React.useRef() as any;
  if (!keyInterpreterRef.current) {
    new KeyInterpreter(editorRef.current);
  }
  const cursorManagerRef: React.MutableRefObject<CursorManager | undefined> = React.useRef();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  (window as any).e = editorRef.current;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) =>
    editorMode === InputMode.Command && keyInterpreterRef.current.keyDown(e);
  const handleKeyUp = (e: React.KeyboardEvent<HTMLElement>) =>
    editorMode === InputMode.Command && keyInterpreterRef.current.keyUp(e);

  const [ready, setReady] = React.useState(false);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    (window.document as any).fonts.load("12px Source Serif").then(function () {
      // console.log("fonts Source Serif ready");
      setReady(true);
    });
  });

  const containerDivRef = useCallbackRef<HTMLDivElement>(null, (div) => {
    if (div) {
      div.focus();
    }
    if (cursorManagerRef.current) {
      cursorManagerRef.current.reset();
      cursorManagerRef.current = undefined;
    }
    if (div) {
      cursorManagerRef.current = new CursorManager(editorRef.current, div);
      cursorManagerRef.current.update();
    }
  });
  useLayoutEffect(() => {
    // After rendering... but before the DOM is painted... update the cursor manger
    cursorManagerRef.current?.update();
  });
  // const textAreaRef = useCallbackRef<typeof TextInputAdapter>(null, (textArea) => {
  //   if (textArea) {
  //     ((textArea as unknown) as HTMLTextAreaElement).focus();
  //   } else {
  //     containerDivRef.current?.focus();
  //   }
  // });

  return (
    <div style={{ minWidth: "100%", minHeight: "100%", backgroundColor: "#e1eef1" }}>
      <div
        ref={containerDivRef}
        style={{
          ...textStyle,
          whiteSpace: "pre",
          padding: 10,
          fontSize: "17.5px",
          lineHeight: "1.35em",
          outline: "none",
        }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      >
        {ready && (
          <EditorContext.Provider value={editorRef.current.services}>
            <DocumentNode node={editorRef.current.document} />
          </EditorContext.Provider>
        )}
      </div>
    </div>
  );
}

export default App;

const textStyle2: React.CSSProperties = {
  fontSize: "16px",
  // color: "white",
  // fontWeight: 600,
  WebkitHyphens: "auto",
  textRendering: "optimizeLegibility",
  // letterSpacing: "0.05em",
  // fontFamily: "'Fira Sans', sans-serif",
  // fontFamily: "'Fira Sans Condensed', sans-serif",
  fontFamily: "'Source Serif', sans-serif",
  fontKerning: "normal",
  fontFeatureSettings: '"kern" 1',
};

const textStyle: React.CSSProperties = {
  fontSize: "16px",
  // color: "white",
  // fontWeight: 600,
  WebkitHyphens: "auto",
  textRendering: "optimizeLegibility",
  // letterSpacing: "0.05em",
  // fontFamily: "'Fira Sans', sans-serif",
  // fontFamily: "'Fira Sans Condensed', sans-serif",
  fontFamily: "'Source Serif', sans-serif",
  fontKerning: "normal",
  fontFeatureSettings: '"kern" 1',
};
