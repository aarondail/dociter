
Interactors are an editor concept (so: not part of the document directly), and
they points to a part of a document that may be interacted with (hence the
name). A particular interactor may be a cursor (pointing to a single cursor
position or node the document) or a selection (which is basically two cursors: a
main cursor and an anchor).

## MERGING

We know we need to merge these things, due to moves, inserts, and deletes. Currently doing it in only one case:

1. Two cursors dont have selection AND are same staus AND mainCuros === on both

But there might be more cases.

## MODALITY

This is not represented in the code at all, but there might be times where an interactor is on a specific part of a document or even something like a modal that is temporary, with other interactors in some kind of frozen state. This would be different than inactive status because the user would have to leave the modal or whatever first before those interactors became unfrozen again.

## INSERTION/DELETION

During deletion we have to deal with overlapping selections (assuming we don't 100% merge).

During insertion and deletion we will have to adjust the positions of interactors following the one where the document is being edited. Would this be easier if we always knew the order of the cursors? If that is true does that mean the order of the mainCursor or the forward/backward locations (in the case of selections where the mainCursor can be forward or backward of the selectionAnchorCursor)?
