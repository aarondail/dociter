import { NodeLayoutProviderRegistry, NodeLayoutReporter } from "doctarion-browser-utils";
import * as DoctarianDocument from "doctarion-document";
import { EditorNodeLookupService } from "doctarion-document";
import React from "react";

export interface EditorContextType extends DoctarianDocument.EditorServices {
  layoutProviderRegistry: NodeLayoutProviderRegistry;
}

export const EditorContext = React.createContext<EditorContextType>({
  lookup: (null as unknown) as EditorNodeLookupService,
  layout: (null as unknown) as NodeLayoutReporter,
  layoutProviderRegistry: (null as unknown) as NodeLayoutProviderRegistry,
});
