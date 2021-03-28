import * as DD from "doctarion-document";
import React, { useEffect } from "react";
import { useCallbackRef } from "use-callback-ref";

import { DocumentNode } from "./DocumentNode";
import { EditorContext } from "./EditorContext";
import { KeyInterpreter } from "./KeyInterpreter";
// import { SAMPLE } from "./sampleText";

interface CursorInfo {
  readonly pathPartIndex: number;
  readonly path: DD.Path;
  readonly affinity: DD.CursorAffinity;
}

/*
const Cursor = () => {
  return <span style={{ height: 10, borderRight: "dashed 2px red" }}></span>;
};

const Inline = React.memo(function Inline(props: { node: DD.Inline; cursorPlacement?: CursorInfo }) {
  const shouldPlaceCursorHere =
    props.cursorPlacement !== undefined && props.cursorPlacement.pathPartIndex === props.cursorPlacement.path.length;

  const shouldInsertCursor =
    props.cursorPlacement !== undefined &&
    props.cursorPlacement.pathPartIndex + 1 === props.cursorPlacement.path.length;
  let insertCursorPos = props.cursorPlacement
    ? DD.PathPart.getIndex(props.cursorPlacement.path[props.cursorPlacement.path.length - 1])
    : 0;
  if (props.cursorPlacement?.affinity === DD.CursorAffinity.After) {
    insertCursorPos++;
  }

  const qqq = useCallbackRef<HTMLSpanElement>(null, (e) => {
    // setTimeout(() => {
    if (e) {
      const r = new Range();
      r.selectNodeContents(e);
      console.log(r);
      const bAr = r.getClientRects();
      for (const b of bAr) {
        // console.log(b);
        // for ()
        // const e2 = document.createElement("div");
        // e2.style.cssText = ` position: absolute; top: ${b.y}px; left: ${b.x}px; width: ${b.width}px; height: ${b.height}px; border: solid 1px red; `;
        // document.body.appendChild(e2);
      }

      r.setStart(e.firstChild!, 18);
      r.setEnd(e.firstChild!, 20);

      const b3 = r.getBoundingClientRect();
      const e3 = document.createElement("div");
      e3.style.cssText = `opacity: 50%; position: absolute; top: ${b3.y + window.scrollY}px; left: ${b3.x}px; width: ${
        b3.width
      }px; height: ${b3.height}px; background-color: magenta;`;
      document.body.appendChild(e3);

      console.log("trying to do texft");
      const d = new Date().getTime();
      for (let i = 0; i < e.textContent!.length; i++) {
        r.setStart(e.firstChild!, i);
        r.setEnd(e.firstChild!, i + 1);

        const b = r.getBoundingClientRect();
        // const b = r.getClientRects()[0];
        const ttt = e.textContent![i];
        // console.log(ttt);
        // console.log(b);
        // for ()
        const e2 = document.createElement("div");
        e2.style.cssText = `opacity: 30%; position: absolute; top: ${b.y + window.scrollY}px; left: ${
          b.x + window.scrollX
        }px; width: ${b.width}px; height: ${b.height}px; border: solid 1px ${
          i % 3 === 0 ? "green" : i % 3 === 1 ? "blue" : "magenta"
        }; `;
        e2.innerText = ttt;
        document.body.appendChild(e2);
      }
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      console.log("TIME TAKEN: " + (new Date().getTime() - d) + "ms");

      // e.focus();
    }
    // }, 1000);
  });

  if (props.node.kind === DD.InlineKind.Text) {
    return (
      <span ref={qqq}>
        {/* {shouldPlaceCursorHere && props.cursorPlacement?.affinity === DD.CursorAffinity.Before && <Cursor />} *}
        {/* {shouldInsertCursor ? (
          <>
            {props.node.text.slice(0, insertCursorPos).join("")}
            <Cursor />
            {props.node.text.slice(insertCursorPos).join("")}
          </>
        ) : ( *}
        {props.node.text.join("")}
        {/* )} *}
        {/* {shouldPlaceCursorHere && props.cursorPlacement?.affinity === DD.CursorAffinity.After && <Cursor />} *}
      </span>
    );
  } else {
    return (
      <a href={props.node.url}>
        {shouldPlaceCursorHere && props.cursorPlacement?.affinity === DD.CursorAffinity.Before && <Cursor />}
        {shouldInsertCursor ? (
          <>
            {props.node.text.slice(0, insertCursorPos).join("")}
            <Cursor />
            {props.node.text.slice(insertCursorPos + 1).join("")}
          </>
        ) : (
          props.node.text.join("")
        )}
        {shouldPlaceCursorHere && props.cursorPlacement?.affinity === DD.CursorAffinity.After && <Cursor />}
      </a>
    );
  }
});

const Block = React.memo(function P(props: { node: DD.Block; cursorPlacement?: CursorInfo }) {
  const shouldPlaceCursorHere =
    props.cursorPlacement !== undefined && props.cursorPlacement.pathPartIndex > props.cursorPlacement.path.length;

  const cPath = !shouldPlaceCursorHere && props.cursorPlacement ? props.cursorPlacement.path : undefined;
  const cDepth = props.cursorPlacement?.pathPartIndex || -1;
  const cChild = cPath ? DD.PathPart.resolveToChild(props.node, cPath[cDepth]) : undefined;

  if (props.node.kind === DD.BlockKind.Paragraph) {
    return (
      <p>
        {shouldPlaceCursorHere && props.cursorPlacement?.affinity === DD.CursorAffinity.Before && <Cursor />}
        {props.node.content.map((c, idx) => (
          <Inline
            key={idx}
            node={c}
            cursorPlacement={
              cPath !== undefined && cChild === c && props.cursorPlacement?.affinity
                ? {
                    pathPartIndex: cDepth + 1,
                    path: cPath,
                    affinity: props.cursorPlacement?.affinity,
                  }
                : undefined
            }
          />
        ))}
        {shouldPlaceCursorHere && props.cursorPlacement?.affinity === DD.CursorAffinity.After && <Cursor />}
      </p>
    );
  } else {
    return (
      <h1>
        {shouldPlaceCursorHere && props.cursorPlacement?.affinity === DD.CursorAffinity.Before && <Cursor />}
        {props.node.content.map((c, idx) => (
          <Inline
            key={idx}
            node={c}
            cursorPlacement={
              cPath !== undefined && cChild === c && props.cursorPlacement?.affinity
                ? {
                    pathPartIndex: cDepth + 1,
                    path: cPath,
                    affinity: props.cursorPlacement?.affinity,
                  }
                : undefined
            }
          />
        ))}
        {shouldPlaceCursorHere && props.cursorPlacement?.affinity === DD.CursorAffinity.After && <Cursor />}
      </h1>
    );
  }
});
*/

enum EditorMode {
  Command,
  Input,
}
function App(): JSX.Element {
  const [doc /*, setDoc*/] = React.useState(
    DD.Document.new(
      "A",
      // DD.Block.paragraph(DD.InlineText.new(SAMPLE)),
      // DD.Block.paragraph(DD.InlineText.new("ThisissometextinaparagrapThisissometextinaparagraph")),
      DD.Block.paragraph(DD.InlineText.new("This is some text in a paragraph")),
      DD.Block.paragraph(DD.InlineText.new("This is more text in a second paragraph"))
    )
  );
  const [editorMode, setEditorMode] = React.useState(EditorMode.Command);
  const editorRef = React.useRef<DD.Editor>(new DD.Editor(doc));
  const keyInterpreterRef = React.useRef(new KeyInterpreter(editorRef.current));

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  (window as any).d = doc;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  (window as any).e = editorRef.current;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) =>
    editorMode === EditorMode.Command && keyInterpreterRef.current.keyDown(e);
  const handleKeyUp = (e: React.KeyboardEvent<HTMLElement>) =>
    editorMode === EditorMode.Command && keyInterpreterRef.current.keyUp(e);

  const [ready, setReady] = React.useState(false);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    (window.document as any).fonts.load("12px Source Serif").then(function () {
      /*... all fonts loaded...*/
      console.log("fonts Source Serif ready");
      setReady(true);
    });
  });

  const containerDivRef = useCallbackRef<HTMLDivElement>(null, (div) => {
    if (div) {
      div.focus();
    }
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
        style={{ ...textStyle, whiteSpace: "pre", padding: 10, fontSize: "17.5px", lineHeight: "1.35em" }}
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
