/* eslint-disable no-irregular-whitespace */
import * as DD from "dociter-document";
import React from "react";

import { SAMPLE } from "./sampleText";

function App(): JSX.Element {
  // const editorRef = React.useRef();
  // React.useEffect(() => {
  //   const text = SAMPLE;
  //   const doc = DD.Document.new("title");
  //   // const editor = DD.Editor(doc);
  //   editorRef.current = editor;
  // }, []);

  return (
    <div style={{ minWidth: "100%", minHeight: "100%", backgroundColor: "#e1eef1" }}>
      <div style={{ ...textStyle, padding: 10, fontSize: "17.5px", lineHeight: "1.35em" }}>{SAMPLE}</div>
    </div>
  );
}

export default App;

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
