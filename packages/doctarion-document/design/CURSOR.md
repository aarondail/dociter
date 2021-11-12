

TODO rewrite to include info about anchors.

NEW POINTS:
1) There are some cursor positions that are equivalent
2) Commands/working-doc/navigation all will prefer after to before except realted to spans around other inlines and maybe osme other caess (check the getvalidcurosrpos file)
3) HOWEVER, all commands/working-doc must work successfully with any valid cursor position BECAUSE anchors dont have to obey those rules.


Placing a cursor (aka caret) in the document, and moving it, is hard.

## High Level Concepts

* Grapheme - A unit of text corresponding to what a user would consider a character as a person would underestand it.
* Nodes - A document is a collection of nodes. Cursors, largely go between graphemes.
* Cursor - A point to a node in a document as well as an orientation.
* Orientation - A cursor can be BEFORE a node, AFTER a node, or on a node which we call ON.
* Orientation Preference - There are sometimes multiple cursor positions that are different but equivalent, e.g. after node A and before node B can be the same position. To make things more deterministic, and make the cursor placement and navigation behave more like a user expects we have a preference system to choose one cursor placement when there are multiple that would techincally work.
* Interactor - The concept of a cursor, possibly with a selection (anchored by another cursor) in the document. A document can have multiple interactors at any given time (for multiple cursors or multiple selections) and they can individually be active or inactive.

## Cursor Positioning 

Cursors can be placed ON any element of a document, but only a subset of those positions along with some before and after positions are "navigable positions". 

What "navigable" here means is a cursor position that can be navigated to (via forwards or backwards navigation, or up and down movement).

There are four kinds of navigable cursor positions:

1. Around (but not on) graphemes in some text containing Inline element (e.g.
   InlineText or InlineUrlLink).
2. On a text containing node, or an inline containing node, that can contain
   children but does not currently have any children.  This could be an
   empty InlineText or InlineUrlLink, or an empty ParagraphBlock or
   HeaderBlock or even the Document itself.
3. Between, before, or after any Inline node that is not an InlineText
   node (e.g. InlineUrlLink) when the sibling is also not an InlineText
   node (or there is no sibling).
4. On a node that is not text containing and is not a grapheme. These are
   nodes that can be navigated to with normal cursor movement but cannot
   contain text, like a emoji or inline image.


We refer to 1 as "graphemes", 2 as "empty insertion points", 3 as "in-between
insertion points", 4 as "navigable non-text nodes".

## Orientation

For "grapheme" and "in-between insertion point" positions, the cursor can be
before or after the node its on, meaning its between the node and its preceding
or following sibling, but not actually on the node. This is represented by the
cursor having a Before or After CursorOrientation. 

## Orientation Preference Details

Some cursor positions are different but equivalent.  E.g.  if two nodes are
siblings, a position on the first node w/ after orientation is the same as a
position on the second node with before orientation.

Because of that, to make the behavior of things like navigation more
deterministic, and make the editor behave in a way that is more like what a
user expects we prefer some cursor positions to others even when they are
equivalent.  Specifically we bias towards positions after nodes and we prefer
to those that relate to a grapheme vs not related to one.

## Line Endings affecting Orientation

One case that is very complicated is when graphemes are at the end of a line
that wraps (i.e.  its at the end of a line visually that is due to a newline
character or because of a soft line wrap due to how the document is
rendered/laid out visually, not because its at the end of an inline which is
at the end of its block).

In general for the last grapheme on a line that is soft wrapped we give try
to keep the cursor off of it.  So instead of allowing the cursor to be placed
on it with after orientation we instead allow the following character to have a
before orientation (when it otherwise might not have).

Note also, that in the logic, the "soft wrapping" applies to an individual
InlineText or InlineUrlLink or other text containing node.  But also applies
to a series of InlineText (only) nodes.  This means the behavior of a pair of
InlineTexts, with a line wrap in between them is different than a pair of
InlineUrlLinks (or one InlineText and one InlineUrlLink).  In the case of
(only) a series of InlineTexts, for determining soft line wraps and the
proper cursor affinities, all those InlineTexts are effectively treated as
one long InlineText node.

## Known Bugs

### 1
During insertion operations, near a soft line wrap the cursor orientation can
end up "wrong" in the sense that it is before the last node on the line.
Normally this would be impossible.

But due to the fact that the operation inserts text and then moves the
cursor, but the layout (visual) rendering of the line hasn't happened, the
cursor movement (which decides which node and orientation to use for the
movement) is effectively using stale layout information and it thinks the
line wrap is in the wrong (old) place.

This is a bug, but it also does not appear to cause any issues currently.  To
fix it, we may have to split the insertion (and other similar operations)
from the cursor movement so that the rendering and layout can happen first.
Which will be tricky.

### 2

Same thing as ^^^ for deletion operations too I think.