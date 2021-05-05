
Placing a cursor (aka caret) in the document, and moving it, is hard.

## High Level Concepts

* Grapheme - A unit of text corresponding to what a user would consider a character as a person would underestand it.
* Nodes - A document is a collection of nodes. Cursors, largely go between graphemes (never on them).
* PositionClassification - There are 3 different kinds of positions in the document structure.
* Affinity - A cursor can be BEFORE a node, AFTER a node, or (in some cases) on a node which we call NEUTRAL.
* Affinity Preference - Because of affinity, there are sometimes multiple cursor positions that are different but equivalent, e.g. after node A and before node B can be the same position. To make things more deterministic, and make the cursor placement and navigation behave more like a user expects we have a preference system to choose one cursor placement when there are multiple that would techincally work.

## PositionClassification Details 

There are four or so KINDS of places where a cursor may be placed GENERALLY:
1. Between, before, and after graphemes.
2. On an node that can contain children but does not currently have any
   children.  This could be an empty InlineText or InlineUrlLink but could
   also be a ParagraphBlock or HeaderBlock or even the Document itself.
3. Between, before, or after any Inline node that is not an InlineText
   node (e.g. InlineUrlLink) when the sibling is also not an InlineText
   node (or there is no sibling).

We refer to 1 as "graphemes", 2 as "empty insertion points", and 3 as
"in-between insertion points".

## Affinity Preference Details

Some cursor positions are different but equivalent.  E.g.  if two nodes are
siblings, a position on the first node w/ after affinity is the same as a
position on the second node with before affinity.

Because of that, to make the behavior of things like navigation more
deterministic, and make the editor behave in a way that is more like what a
user expects we prefer some cursor positions to others even when they are
equivalent.  Specifically we bias towards positions after nodes and we prefer
to those that relate to a grapheme vs not realted to one.

## Line Endings afecting Affinity

One caes that is very complicated is when graphemes are at the end of a line
that wraps (i.e.  its at the end of a line visually that is due to a newline
character or because of a soft line wrap due to how the document is
rendered/laid out visually, not because its at the end of an inline which is
at the end of its block).

In general for the last grapheme on a line that is soft wrapped we give try
to keep the cursor off of it.  So instead of allowing the cursor to be placed
on it with after affinity we instead allow the following character to have a
before affinity (when it otherwise might not have).

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
During insertion operations, near a soft line wrap the cursor affinity can
end up "wrong" in the sense that it is before the last node on the line.
Normally this would be impossible.

But due to the fact that the operation inserts text and then moves the
cursor, but the layout (visual) rendering of the line hasn't happened, the
cursor movement (which decides which node and affinity to use for the
movement) is effectively using stale layout information and it thinks the
line wrap is in the wrong (old) place.

This is a bug, but it also does not appear to cause any issues currently.  To
fix it, we may have to split the insertion (and other similar operations)
from the cursor movement so that the rendering and layout can happen first.
Which will be tricky.