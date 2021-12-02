
Unfortunately handling, editing, and rendering text for in the context of a text editor is sorta hard and complicated. In this doc I will try to impart my understanding.

Picture bunch of layers. From top to bottom the character of the layers will roughly go from being closer to "rendering", then to "editing", and finally to "storage".

# Glyph

At a high level when we are rendering text we talk about rendering glyphs. These
are little images (waving hands here) that are stored in a font (.ttf, .otf,
etc). The font maps lower-level graphemes (see below) to these glyph (image
things).

You can think of a glyph as "a character (from a font) that can be rendered".

For rendering some text we have to choose the proper font (file), take the
graphemes from the text and map them to the glyphs, and then actually render the
glyph. Actually there is s a lot of complexity I am glossing over but one
important detail is that a glyph _may_ (depending on font) represent multiple
(sequential) graphemes (e.g. ligatures) (rather than one glyph per grapheme).

# Grapheme

A grapheme (AKA grapheme cluster) is a sorta like a character as a person would
understand it. The concept is a bit fuzzy, but that is the core idea. Graphemes
are the most basic unit of text. In the (Doctarion) document model text is
stored as a series of graphemes.

Unlike a glyph, graphemes are font independent. Though, note (as described
above) a glyph may actually correspond to one or more graphemes in some cases
(and it may vary by font).

Storage wise, graphemes consist one or more code points (the next layer below).

From https://www.oreilly.com/library/view/unicode-demystified/0201700522/0201700522_ch04lev1sec9.html:
> A grapheme cluster is a sequence of one or more Unicode code points that
> should be treated as a single unit by various processes:
> Text-editing software should generally allow placement of the cursor only at grapheme cluster boundaries. Clicking the mouse on a piece of text should place the insertion point at the nearest grapheme cluster boundary, and the arrow keys should move forward and back one grapheme cluster at a time.

In JavaScript to get the graphemes in a string, you have to use a library
because the unicode algorithm to do that is complicated.

# Code Points

Code points ARE unicode characters. Not actual characters, but unicode
characters. They are the basic "unit of meaning" so to speak for unicode.
 
In many cases they are 1-to-1 with a grapheme, but in others they aren't (e.g.
👩‍👩‍👧‍👧 which is one grapheme but multiple code points).

To get code points from a string in JavaScript do `[...aString]`.

Doctarion doesn't directly do anything with code points. The problem is that
since they don't correspond to characters in all cases, we can't use them for
navigation or selection (like w/ graphemes).

https://exploringjs.com/impatient-js/ch_unicode.html may be useful to read.

# Code Units

Code points in turn encode code points. There are different encoding formats,
and in JavaScript (strings) (in-memory strings) UTF16 is used. Thus, JavaScript
strings are arrays of double byte UTF16 code units.

Code units are dependent on the encoding, I think. So UTF16 code units are not
the same as UTF8 code units (though they both may encode the same unicode code
points).

An code unit may also be a code point, but just like how a grapheme may be made
of one or more code points, a code point may be made of one or more code units.
Especially if we are talking about different encodings.


# Further Reading

* https://manishearth.github.io/blog/2017/01/14/stop-ascribing-meaning-to-unicode-code-points/
* https://stackoverflow.com/questions/27331819/whats-the-difference-between-a-character-a-code-point-a-glyph-and-a-grapheme