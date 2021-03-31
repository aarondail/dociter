import * as DoctarianDocument from "doctarion-document";
import React from "react";

export interface EditorContextType {
  ids: DoctarianDocument.EditorNodeIdService;
  layout: DoctarianDocument.EditorNodeLayoutService;
  // update: (operation: DoctarianDocument.EditorOperation) => void;
}

export const EditorContext = React.createContext<EditorContextType>({
  ids: new DoctarianDocument.EditorNodeIdService(),
  layout: new DoctarianDocument.EditorNodeLayoutService(new DoctarianDocument.EditorNodeIdService()),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  // update: () => {},
});
