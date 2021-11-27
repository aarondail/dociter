/* eslint-disable jest/no-export */
import { Commands, Editor, EditorConfig } from "../../src";
import { testDoc } from "../utils";

export const CommandsTestUtils = {
  testDocs: {
    basicDoc: testDoc`
<h level=ONE> <s>Header1</s> </h>
<p> <s styles=6:+B>MMNNAABB</s> </p>
<p> </p>
<p> <s>CC</s> <hyperlink url=g.com>GOOGLE</hyperlink> <s>DD</s> </p>
`,
  },

  getEditorForBasicDoc(options?: Omit<EditorConfig, "document">): Editor {
    const editor = new Editor({ document: CommandsTestUtils.testDocs.basicDoc, ...options });
    if (editor.state.focusedInteractor) {
      editor.execute(Commands.updateInteractor({ id: editor.state.focusedInteractor.id, name: "᯼" }));
    }
    return editor;
  },
};
