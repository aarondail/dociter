import * as DoctarianDocument from "doctarion-document";
import React from "react";

export type EditorContextType = DoctarianDocument.EditorServices;

export const EditorContext = React.createContext<EditorContextType>({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
  lookup: new DoctarianDocument.EditorNodeLookupService({} as any),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
  layout: new DoctarianDocument.EditorNodeLayoutService(),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  // update: () => {},
});
