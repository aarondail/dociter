import * as immer from "immer";

import { EditorOperationServices } from "./services";
import { EditorState } from "./state";

export type EditorOperation = (draft: immer.Draft<EditorState>, services: EditorOperationServices) => void;
