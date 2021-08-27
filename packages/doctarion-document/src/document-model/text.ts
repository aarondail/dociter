import GraphemeSplitter from "grapheme-splitter";

import { Grapheme } from "./grapheme";

/**
 * We store text as an array of graphemes to ease reasoning about the text. For
 * example moving the cursor left can be done by just subtracting one from an
 * index into the grapheme array.
 *
 * That said, I didn't think incredibly deeply about this maybe this design is
 * bonkers. Maybe it would be simpler to store the graphemes ALONGSIDE the
 * (combined) string. Or just convert the string to graphemes as needed.
 *
 * Anyways, getting a normal string back from the text is as simple as joining
 * the array.
 */
export type Text = readonly Grapheme[];

const splitter = new GraphemeSplitter();

export const Text = {
  fromString(s: string): Text {
    // This (believe it or not) splits the string into graphemes
    // https://stackoverflow.com/questions/21397316/split-javascript-string-into-array-of-codepoints-taking-into-account-surrogat
    // return [...s];

    // This splits the string into graphemes
    return splitter.splitGraphemes(s);
  },
  toString(t: Text): string {
    return t.join("");
  },
};
