/* eslint-disable jest/no-export */
import { testDoc } from "../test-utils";

export const WorkingDocumentTestUtils = {
  testDocs: {
    basicDoc: testDoc`
<h level=ONE> <s>Header1</s> </h>
<p> <s styles=6:+B>MMNNAABB</s> </p>
<p> </p>
<p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>
`,
  },
};
