import { Commands, InteractorTargets } from "../../src/commands";
import { JoinType } from "../../src/commands/joinCommands";
import { FlowDirection } from "../../src/miscUtils";
import { CursorOrientation } from "../../src/traversal";
import { InteractorStatus } from "../../src/working-document";
import { docToXmlish, dumpAnchorsFromWorkingDocument } from "../utils";

import { CommandsTestUtils } from "./commands.testUtils";

const { Before, On, After } = CursorOrientation;
const { Inactive, Active } = InteractorStatus;

describe("join blocks with multiple interactors", () => {
  describe("backwards", () => {
    it("basically works with one focused interactor", () => {
      const editor = CommandsTestUtils.getEditorForBasicDoc();
      editor.execute(Commands.updateInteractor({ id: editor.state.focusedInteractor!.id, name: "α" }));
      editor.execute(Commands.jump({ to: { path: "1/0/3", orientation: After } }));

      editor.execute(Commands.addInteractor({ at: { path: "0/0/0", orientation: Before }, name: "β" }));
      editor.execute(Commands.addInteractor({ at: { path: "1/0/0", orientation: Before }, name: "γ" }));
      editor.execute(Commands.addInteractor({ at: { path: "0/0/6", orientation: After }, name: "δ" }));
      editor.execute(Commands.addInteractor({ at: { path: "1/0/7", orientation: After }, name: "ε" }));
      editor.execute(Commands.addInteractor({ at: { path: "2", orientation: On }, name: "ζ" }));
      editor.execute(
        Commands.addInteractor({
          at: { path: "2", orientation: After },
          selectTo: {
            path: "3/1/4",
            orientation: After,
          },
          name: "η",
        })
      );

      editor.execute(
        Commands.join({
          type: JoinType.Blocks,
          target: InteractorTargets.Focused,
          direction: FlowDirection.Backward,
          allowNodeTypeCoercion: true,
        })
      );

      expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
        "<h level=ONE> <s styles=13:+B>Header1MMNNAABB</s> </h>
        <p> </p>
        <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
      `);
      // Note the δ interactor is de-duped (in favor of γ)
      expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
        "Anchor: α-MAIN AFTER (Span:N)0/0⁙10 intr: α 
        Anchor: β-MAIN BEFORE (Span:H)0/0⁙0 intr: β 
        Anchor: γ-MAIN AFTER (Span:1)0/0⁙6 intr: γ 
        Anchor: ε-MAIN AFTER (Span:B)0/0⁙14 intr: ε 
        Anchor: ζ-MAIN ON (Paragraph)1 intr: ζ 
        Anchor: η-MAIN ON (Paragraph)1 intr: η 
        Anchor: η-SELECTION AFTER (Hyperlink:L)2/1⁙4 intr: η "
      `);
    });

    it("works with multiple interactors being targeted", () => {
      const editor = CommandsTestUtils.getEditorForBasicDoc();
      editor.execute(Commands.updateInteractor({ id: editor.state.focusedInteractor!.id, name: "α" }));
      editor.execute(Commands.jump({ to: { path: "1/0/3", orientation: After } }));

      editor.execute(
        Commands.addInteractor({ at: { path: "0/0/0", orientation: Before }, name: "β", status: Inactive })
      );
      editor.execute(Commands.addInteractor({ at: { path: "1/0/0", orientation: Before }, name: "γ", status: Active }));
      editor.execute(Commands.addInteractor({ at: { path: "1/0", orientation: On }, name: "δ", status: Inactive }));
      editor.execute(
        Commands.addInteractor({ at: { path: "1/0/7", orientation: After }, name: "ε", status: Inactive })
      );
      editor.execute(Commands.addInteractor({ at: { path: "3/0/1", orientation: After }, name: "ζ", status: Active }));

      editor.execute(
        Commands.addInteractor({
          at: { path: "2", orientation: After },
          selectTo: {
            path: "3/1/4",
            orientation: After,
          },
          status: Inactive,
          name: "η",
        })
      );
      editor.execute(
        Commands.join({
          type: JoinType.Blocks,
          target: InteractorTargets.AllActive,
          direction: FlowDirection.Backward,
          allowNodeTypeCoercion: true,
        })
      );

      expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
        "<h level=ONE> <s styles=13:+B>Header1MMNNAABB</s> </h>
        <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
      `);
      // Note the δ interactor is NOT de-duped in this test (unlike the previous
      // one) because it has a different status than γ.
      expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
        "Anchor: α-MAIN AFTER (Span:N)0/0⁙10 intr: α 
        Anchor: β-MAIN BEFORE (Span:H)0/0⁙0 intr: β 
        Anchor: γ-MAIN AFTER (Span:1)0/0⁙6 intr: γ 
        Anchor: δ-MAIN AFTER (Span:1)0/0⁙6 intr: δ 
        Anchor: ε-MAIN AFTER (Span:B)0/0⁙14 intr: ε 
        Anchor: ζ-MAIN AFTER (Span:C)1/0⁙1 intr: ζ 
        Anchor: η-MAIN BEFORE (Span:C)1/0⁙0 intr: η 
        Anchor: η-SELECTION AFTER (Hyperlink:L)1/1⁙4 intr: η "
      `);
    });
  });

  describe("forwards", () => {
    it("works with multiple interactors being targeted", () => {
      const editor = CommandsTestUtils.getEditorForBasicDoc();
      editor.execute(Commands.updateInteractor({ id: editor.state.focusedInteractor!.id, name: "α" }));
      editor.execute(Commands.jump({ to: { path: "0/0/5", orientation: After } }));

      editor.execute(
        Commands.addInteractor({ at: { path: "0/0/0", orientation: Before }, name: "β", status: Inactive })
      );
      editor.execute(Commands.addInteractor({ at: { path: "0/0/6", orientation: After }, name: "γ", status: Active }));
      editor.execute(Commands.addInteractor({ at: { path: "1/0", orientation: On }, name: "δ", status: Inactive }));
      editor.execute(
        Commands.addInteractor({ at: { path: "1/0/7", orientation: After }, name: "ε", status: Inactive })
      );
      editor.execute(Commands.addInteractor({ at: { path: "2", orientation: On }, name: "ζ", status: Active }));

      editor.execute(
        Commands.addInteractor({
          at: { path: "2", orientation: After },
          selectTo: {
            path: "3/1/4",
            orientation: After,
          },
          status: Inactive,
          name: "η",
        })
      );

      editor.execute(
        Commands.join({
          type: JoinType.Blocks,
          target: InteractorTargets.AllActive,
          direction: FlowDirection.Forward,
          allowNodeTypeCoercion: true,
        })
      );

      expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(`
        "<p> <s styles=13:+B>Header1MMNNAABB</s> </p>
        <p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>"
      `);
      expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
        "Anchor: α-MAIN AFTER (Span:r)0/0⁙5 intr: α 
        Anchor: β-MAIN BEFORE (Span:H)0/0⁙0 intr: β 
        Anchor: γ-MAIN AFTER (Span:1)0/0⁙6 intr: γ 
        Anchor: δ-MAIN AFTER (Span:1)0/0⁙6 intr: δ 
        Anchor: ε-MAIN AFTER (Span:B)0/0⁙14 intr: ε 
        Anchor: ζ-MAIN BEFORE (Span:C)1/0⁙0 intr: ζ 
        Anchor: η-MAIN BEFORE (Span:C)1/0⁙0 intr: η 
        Anchor: η-SELECTION AFTER (Hyperlink:L)1/1⁙4 intr: η "
      `);
    });
  });
});
