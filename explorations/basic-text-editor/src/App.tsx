import * as DoctarionDocument from "doctarion-document";
import React from "react";

import { Editor } from "./Editor";

import "./App.css";

function App(): JSX.Element {
  const [doc /*, setDoc*/] = React.useState(
    DoctarionDocument.Document.new(
      "A",
      DoctarionDocument.Block.paragraph(
        DoctarionDocument.InlineText.new("The quick brown fox 🦊 ate a zesty hamburgerfons 🍔.The 👩‍👩‍👧‍👧 laughed.")
      ),
      DoctarionDocument.Block.paragraph(DoctarionDocument.InlineText.new("This is more text in a second paragraph")),
      DoctarionDocument.Block.paragraph(
        DoctarionDocument.InlineText.new("Lorem Ipsum "),
        DoctarionDocument.InlineText.new("is simply dummy text", {
          bold: true,
        }),
        DoctarionDocument.InlineText.new(" of the printing "),
        DoctarionDocument.InlineText.new("and typesetting industry.", {
          backgroundColor: "blue",
        }),
        DoctarionDocument.InlineText.new(
          " Lorem Ipsum has been the industry's standard dummy text ever since the 1500s,",
          {
            italic: true,
            foregroundColor: "white",
            backgroundColor: "black",
          }
        ),
        DoctarionDocument.InlineText.new(
          ", when an unknown printer took a galley of type and scrambled it to make a type specimen book. "
        ),
        DoctarionDocument.InlineUrlLink.new("It has survived", "http://abcdef.com"),
        DoctarionDocument.InlineText.new(
          " not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum."
        )
      )
      // DoctarionDocument.Block.paragraph(
      //   DoctarionDocument.InlineText.new("Paragraph with\nactual some actual\nnew lines in it!")
      // ),
      // DoctarionDocument.Block.paragraph(DoctarionDocument.InlineText.new("Support j/k")),
      // DoctarionDocument.Block.paragraph(DoctarionDocument.InlineText.new("Support arrow keys in both modes")),
      // DoctarionDocument.Block.paragraph(DoctarionDocument.InlineText.new("Animate cursor")),
      // DoctarionDocument.Block.paragraph(DoctarionDocument.InlineText.new("Support enter in insert breaking lines up")),
      // DoctarionDocument.Block.paragraph(DoctarionDocument.InlineText.new("Make inserting a header work")),
      // DoctarionDocument.Block.paragraph(
      //   DoctarionDocument.InlineText.new("Make inserting different font/bold/color work")
      // ),
      // DoctarionDocument.Block.paragraph(DoctarionDocument.InlineText.new("This is more text in a second paragraph")),
      // DoctarionDocument.Block.paragraph(
      //   DoctarionDocument.InlineText.new("Support selection with shift keys in insert mode")
      // ),
      // DoctarionDocument.Block.paragraph(
      //   DoctarionDocument.InlineText.new("Support selection with mouse (browser based selection basically)")
      // ),
      // DoctarionDocument.Block.paragraph(
      //   DoctarionDocument.InlineText.new("Overwrtie selection on insert (and delete works)")
      // ),
      // DoctarionDocument.Block.paragraph(DoctarionDocument.InlineText.new("Turn document types into classes"))
    )
  );

  return (
    <div className="App">
      <Editor initialDocument={doc} />
    </div>
  );
}

export default App;
