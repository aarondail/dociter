/**
 * A grapheme (or grapheme cluster) is a sorta like a character as a person
 * would understand it, though its fuzzy and (since it is independent of a font
 * which actually produces visuals) maybe best thought of as an approximation
 * that mostly works and works progomatically (indpendently of a font).
 *
 * We use this as the basis for text in our models since it is the most basic
 * unit of text we expect users to interact with.
 *
 * In a nutshell:
 * A JavaScript string is an array of UTF16 code points (i.e. double byte
 * numbers), and one or more code points map to code units (i.e. unicode
 * characters), and in turn one or more code points map to graphemes (i.e.
 * characters as a human would understand them).
 *
 * For more info see `/design/CHARACTERS.md`.
 */
export type Grapheme = string;
