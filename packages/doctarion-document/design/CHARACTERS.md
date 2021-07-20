
Unfortunately editing and rendering text is very hard. In this doc I will try to impart my understanding.

Picture bunch of layers. From top to bottom the character of the layers will go from "rendering", to "editing", to "storage", but there are more than three layers.

# Glyph

At the highest level (still related to characters and not just pixels or drawing instructions) are glyphs. These are little images (waving hands) that are stored in a font (.ttf, .otf, etc). The font *maps* lower-level graphemes to these glyphs.

For rendering, choosing the proper font for some text, pulling out the glphys, and actually drawing the glyph involes a lot more complexity which I will ignore in this doc. The gist is, you can think of a glyph as "a character (from a font) rendered to the screen".

One important detail: a glyph _may_ (depending on font) represent multiple (sequential) graphemes concepts (e.g. ligatures).

Another important detail: I _believe_ the input to the font is a series of code points or code units, not graphemes which are the next (logical) layer.

# Grapheme

A grapheme (AKA grapheme cluster) is a sorta like a character as a person would
understand it. The concept is a bit fuzzy, but that is the core idea.

Storage wise, graphemes are one or more code points (the next layer below).

From https://www.oreilly.com/library/view/unicode-demystified/0201700522/0201700522_ch04lev1sec9.html:
> A grapheme cluster is a sequence of one or more Unicode code points that
> should be treated as a single unit by various processes:
> Text-editing software should generally allow placement of the cursor only at grapheme cluster boundaries. Clicking the mouse on a piece of text should place the insertion point at the nearest grapheme cluster boundary, and the arrow keys should move forward and back one grapheme cluster at a time.

Thus, graphemes are the most basic unit of text. In the document models text is stored as a series of graphemes.

In JavaScript to get the graphemes in a string, you have to use a library because the unicode algorithm to do that is complicated.

Also note that graphemes are unrelated to fonts, and is thus independent of how text is rendered.

# Code Points

Code points ARE unicode characters. Not actual characters, but unicode characters. They are the basic "unit of meaning" so to speak for unicode.
 
In many cases they are 1-to-1 with a grapheme, but in others they aren't (e.g. 👩‍👩‍👧‍👧).

To get code points from a string in JavaScript do `[...aString]`.

This project doesn't directly do anything with code points. The problem again is that since they don't correspond to characters in all cases trying to select or navigate through them characters will result in iffy behavior to a user.

https://exploringjs.com/impatient-js/ch_unicode.html may be useful to read.

# Code Units

Code points in turn encode code points. There are different encoding formats, and in JavaScript (strings) (in-memory strings) UTF16 is used. Thus, JavaScript strings are arrays of double byte UTF16 code units.

They individually may be a code point, but just like how a grapheme may be made of one or more code points, a code point may be made of one or more code units. Especially if we are talking about different encodings.


# Further Reading

* https://manishearth.github.io/blog/2017/01/14/stop-ascribing-meaning-to-unicode-code-points/
* https://stackoverflow.com/questions/27331819/whats-the-difference-between-a-character-a-code-point-a-glyph-and-a-grapheme