/**
 * A grapheme (or grapheme cluster) is a sorta like a character as a person
 * would understand it, though its fuzzy and (since it is independent of a font
 * which actually produces visuals) maybe best thought of as an approximation
 * that mostly works and works progomatically (indpendently of a font).
 *
 * We use this as the basis for text in our models since it is the most basic
 * unit of text we expect users to interact with.
 *
 *
 * Why not Graphemes?
 * Graphemes are the basic unit of meaning in unicode. In JavaScript you can
 * get graphemes from a string via [...aString]. The problem with graphemes
 * is that they don't correspond to characters in all cases, which is a problem
 * for a text editor trying to select or navigate through characters in a
 * document. There are characters that take up multiple graphemes, and graphemes
 * capture that idea.
 *
 *
 * Why not use Code Units?
 * Code units are, in JavaScript, the UTF16 double bytes that make up strings.
 * They individually may be a grapheme but may not necessarily the whole code
 * unit. In other words, ASCII characters, and really a lot of other characters
 * that fit in 16 bits, this would be fine. A code unit in that case is a code
 * point is a grapheme. But the problem is that there are characters that
 * consist of multiple (2+) code units, and it doesn't make sense for a text
 * editor to operate at that level. It would be weird, for example, to hit
 * backspace and have the character before the cursor morph into mojibake
 * (invalid grapheme) rather than be deleted. The problem is basically
 * analgous to the problem with graphemes.
 *
 *
 * From https://www.oreilly.com/library/view/unicode-demystified/0201700522/0201700522_ch04lev1sec9.html:
 * A grapheme cluster is a sequence of one or more Unicode graphemes that
 * should be treated as a single unit by various processes:
 *
 * Text-editing software should generally allow placement of the cursor only at
 * grapheme cluster boundaries. Clicking the mouse on a piece of text should
 * place the insertion point at the nearest grapheme cluster boundary, and the
 * arrow keys should move forward and back one grapheme cluster at a time.
 *
 *
 * Other info:
 * https://manishearth.github.io/blog/2017/01/14/stop-ascribing-meaning-to-unicode-code-points/
 * https://stackoverflow.com/questions/27331819/whats-the-difference-between-a-character-a-code-point-a-glyph-and-a-grapheme
 *
 */
export type Grapheme = string;
