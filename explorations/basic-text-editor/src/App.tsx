import * as DoctarionDocument from "doctarion-document";
import React from "react";

import { Editor } from "./Editor";

import "./App.css";

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

  return (
    <div style={{ display: "flex", minWidth: "100%", minHeight: "100%", backgroundColor: "#e1eef1" }}>
      <Editor initialDocument={doc} />
    </div>
  );
}

export default App;
