import { CodePoint } from "./basics";

// An Array of Code Points! (Maybe this should be graphemes?)
export type Text = readonly CodePoint[];

export const Text = {
  fromString(s: string): Text {
    // This (believe it or not) splits the string into code points
    // https://stackoverflow.com/questions/21397316/split-javascript-string-into-array-of-codepoints-taking-into-account-surrogat
    return [...s];
  },
};
