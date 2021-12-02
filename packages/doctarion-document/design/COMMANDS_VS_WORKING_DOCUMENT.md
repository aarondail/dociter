
## WorkingDocument

The WorkingDocument represents a mutable Document, along with all the
Interactors (and any additional Anchors) on that Document. All mutations to
these objects go through methods on the WorkingDocument itself. Access is
readonly to any object that the WorkingDocument owns (Nodes, Anchors,
Interactors, etc).

In the context of the editor, the WorkingDocument _is_ the Document being
edited.

The WorkingDocument mutation methods are somewhat low level and are focused on
transforming and updating objects without regard (generally) for the
concerns of a text editing app. For example, the editor may move Anchors
on a Node when it is deleted but it doesn't have any conception of where
to move an Anchor if the user wants to advice it by a word or line.

## Commands

Commands are the layer that encodes the capabilities, logic, and concerns of the
text editing app for editing the Document. Generally, the UI issues Commands,
the Commands call methods on the WorkingDocument, and the WorkingDocument 
updates the Nodes, Anchors, and Interactors (which again are exposed to the
other layers, but only in readonly form).

In terms of Anchors, Commands encode all the movement logic, aside from what 
constitutes a valid cursor (and thus Anchor) position (that is handled by the
`CursorNavigator`) and from some logic in the `WorkingDocument` that moves
Anchors on nodes that are deleted or joined together. That logic could arguably
be in the Commands, but it wouldn't totally make sense for a few reasons
including the fact that some Anchors are _not_ related to Interactors and thus
DON'T represent a cursor to a user.