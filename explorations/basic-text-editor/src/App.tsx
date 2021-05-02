import * as DoctarionDocument from "doctarion-document";
import React from "react";

import { Editor } from "./Editor";

import "./App.css";

function App(): JSX.Element {
  const [doc /*, setDoc*/] = React.useState(
    new DoctarionDocument.Document(
      "A",
      new DoctarionDocument.ParagraphBlock(new DoctarionDocument.InlineText("test")),
      new DoctarionDocument.ParagraphBlock(
        new DoctarionDocument.InlineText(
          "This is a really long block of text. , when an unknown printer took a galley of type and scrambled it to make a type specimen book.  not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum." +
            "This is a really long block of text. , when an unknown printer took a galley of type and scrambled it to make a type specimen book.  not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum." +
            "This is a really long block of text. , when an unknown printer took a galley of type and scrambled it to make a type specimen book.  not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum." +
            "This is a really long block of text. , when an unknown printer took a galley of type and scrambled it to make a type specimen book.  not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum." +
            "This is a really long block of text. , when an unknown printer took a galley of type and scrambled it to make a type specimen book.  not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum." +
            "This is a really long block of text. , when an unknown printer took a galley of type and scrambled it to make a type specimen book.  not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum." +
            "This is a really long block of text. , when an unknown printer took a galley of type and scrambled it to make a type specimen book.  not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum." +
            "This is a really long block of text. , when an unknown printer took a galley of type and scrambled it to make a type specimen book.  not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum." +
            "This is a really long block of text. , when an unknown printer took a galley of type and scrambled it to make a type specimen book.  not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum." +
            "This is a really long block of text. , when an unknown printer took a galley of type and scrambled it to make a type specimen book.  not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum."
        )
      ),
      new DoctarionDocument.ParagraphBlock(
        new DoctarionDocument.InlineText("The quick brown fox 🦊 ate a zesty hamburgerfons 🍔.The 👩‍👩‍👧‍👧 laughed.")
      ),
      new DoctarionDocument.ParagraphBlock(new DoctarionDocument.InlineText("This is more text in a second paragraph")),

      new DoctarionDocument.ParagraphBlock(
        new DoctarionDocument.InlineText("Paragraph with\nactual some actual\nnew lines in it!")
      ),
      new DoctarionDocument.ParagraphBlock(new DoctarionDocument.InlineText("Support j/k")),
      new DoctarionDocument.ParagraphBlock(new DoctarionDocument.InlineText("Support arrow keys in both modes")),
      new DoctarionDocument.ParagraphBlock(new DoctarionDocument.InlineText("Animate cursor")),
      new DoctarionDocument.ParagraphBlock(
        new DoctarionDocument.InlineText("Support enter in insert breaking lines up")
      ),
      new DoctarionDocument.ParagraphBlock(new DoctarionDocument.InlineText("Make inserting a header work")),
      new DoctarionDocument.ParagraphBlock(
        new DoctarionDocument.InlineText("Make inserting different font/bold/color work")
      ),
      new DoctarionDocument.ParagraphBlock(new DoctarionDocument.InlineText("This is more text in a second paragraph")),
      new DoctarionDocument.ParagraphBlock(
        new DoctarionDocument.InlineText("Support selection with shift keys in insert mode")
      ),
      new DoctarionDocument.ParagraphBlock(
        new DoctarionDocument.InlineText("Support selection with mouse (browser based selection basically)")
      ),
      new DoctarionDocument.ParagraphBlock(
        new DoctarionDocument.InlineText("Overwrtie selection on insert (and delete works)")
      ),
      new DoctarionDocument.ParagraphBlock(new DoctarionDocument.InlineText("Turn document types into classes")),

      // Block w/ lots of diff text
      new DoctarionDocument.ParagraphBlock(
        new DoctarionDocument.InlineText("Lorem Ipsum "),
        new DoctarionDocument.InlineText("is simply dummy text", {
          bold: true,
        }),
        new DoctarionDocument.InlineText(" of the printing "),
        new DoctarionDocument.InlineText("and typesetting industry.", {
          backgroundColor: "blue",
        }),
        new DoctarionDocument.InlineText(
          " Lorem Ipsum has been the industry's standard dummy text ever since the 1500s,",
          {
            italic: true,
            foregroundColor: "white",
            backgroundColor: "black",
          }
        ),
        new DoctarionDocument.InlineText(
          ", when an unknown printer took a galley of type and scrambled it to make a type specimen book. "
        ),
        new DoctarionDocument.InlineUrlLink("It has survived", "http://abcdef.com"),
        new DoctarionDocument.InlineText(
          "This is a really long block of text. , when an unknown printer took a galley of type and scrambled it to make a type specimen book.  not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum."
        )
      )
    )
  );

  return (
    <div className="App">
      <Editor initialDocument={doc} />
    </div>
  );
}

export default App;
