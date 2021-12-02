Placing, moving, and modelling, a cursor (aka caret) in the document is a bit complicated.

## Read First

* [./GRAPHEMES_AND_CHARACTERS.md] 

## Cursors, Anchors, and Interactors

Cursors are modeled as a combination of two more basic concepts in Doctarion:
1. Anchors
2. Interactors

Anchors are little objects that are attached to a node or grapheme and have an
orientation: before, after, or on.

Interactors are other little objects that own either one or two anchors. I generally
think of interactors as the cursor equivalent, and anchors as the location information,
though selections break that a little bit.

Basically if an interactor has one anchor it is very much like a cursor, but if it
has two (a main anchor and a selection anchor) it functions as a selection with
the ends (of the selection) between two anchors. In the selection case, its a little
confusing because the two ends of the selection can also seem like cursors.

For the rest of the doc, when I say "cursor" take it to mean an interactor along
with either the sole anchor, or one of the two anchors in the case of
selections.

## Cursor Positions 

As cursors are modelled by anchors, they can be on any node and have any
orientation (before, after, on).

While all anchor positions are valid positions for a cursor, not all those
positions are _navigable_.

Navigable means something to the effect of if you put the cursor at the
beginning of the document, and hit the right arrow key, what are all the
positions you encounter up to the end of the document.

## Navigable Cursor Positions

There are four kinds of navigable cursor positions:

1. Around (but not on) graphemes in some text containing inline element (e.g.
   Span).
2. On an empty node that can have children but doesn't.  This could be an empty
   Span or Paragraph or even the Document itself.
3. Before or after any inline node that is not a Span, as long as the 
   sibling on that side of the node (if any) is not a Span.
4. On a node that cannot have children.

We refer to 1 as "graphemes", 2 as "empty insertion points", 3 as "in-between
insertion points", 4 as "navigable non-text nodes".

## Preferred Cursor Positions

Some cursor positions are different but equivalent.  E.g. if two nodes are
siblings, a position on the first node w/ after orientation is the same as a
position on the second node with before orientation.

To make the behavior of things like cursor navigation more deterministic and
consistent (no matter what code is actually updating the cursor) we prefer some
cursor positions to others even when they are equivalent.

The rules are:

1) After positions are preferred to before positions
2) Except if choosing the non-preferred position is on a Span (specifically
Span) and the preferred isn't.

How does this mater in practice? The WorkingDocument, CursorNavigator, and
Commands, etc will choose preferred positions when moving/navigating cursors.

(That said, all of those classes must still behave correctly whether they have a
preferred or non-preferred position to work with.)

## WorkingDocument Responsibilities w.r.t. Cursors

For node deletion, joining, and some insertions the WorkingDocument will try to
keep the anchor on the same node (in the case of insertions moving it around),
and will otherwise try to intelligently move the anchors (when joining or
deleting). Different anchor types may get different treatment. Those that are
related to an interactor, because they are effectively cursors may be moved in
some cases where other anchor types aren't.

The WorkingDocument has to make sure that preferred cursor positions are chosen
when it does update an anchor in one of those situations. Cursors are allowed on
non-preferred positions when they are added or created by anything outside of
the WorkingDocument itself though, and it has to work with those positions.

## Command Responsibilities w.r.t. Cursors

For some commands like deletion, the WorkingDocument does the hard work of
making sure the interactor anchors are moved to the proper logical cursor
positions. For some other commands though, like insertion, where the cursor is
really being moved by the user to a new node, the command itself takes on the
responsibility of moving the anchor to the right next spot.


## Line Wraps

During rendering a line of text may wrap at various points. This is irrelevant
and not the concern of the Doctarion Document code, but is a concern to the
rendering code.  This is because it looks more natural in some cases for a
cursor to be at the beginning of a new line of code, rather than at the end of a
line (before the wrap).

So, the UI and rendering code has to handle that (fudge the position of the
cursor a bit basically).

There was a version of this library that DID take into account line wraps when navigating
cursors around, so that determining the preferred position for a cursor had to 
determine if the cursor preceded or followed a line wrap.

The code to make that work was slow, and very complicated. That is why this
library doesn't deal with it anymore.



