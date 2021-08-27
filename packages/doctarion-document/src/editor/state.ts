import { FriendlyIdGenerator } from "doctarion-utils";
import { immerable } from "immer";

import { Document } from "../document-model";
import { Interactor, InteractorId, ReadonlyWorkingDocument, WorkingDocument } from "../working-document";

export interface ReadonlyEditorState extends ReadonlyWorkingDocument {
  readonly focusedInteractorId: InteractorId | undefined;
  readonly focusedInteractor: Interactor | undefined;
}

export class EditorState extends WorkingDocument implements ReadonlyEditorState {
  public readonly focusedInteractorId: InteractorId | undefined;

  [immerable] = true;

  public constructor(document: Document, idGenerator: FriendlyIdGenerator) {
    super(document, idGenerator);
  }

  public get focusedInteractor(): Interactor | undefined {
    if (this.focusedInteractorId !== undefined) {
      return this.getInteractor(this.focusedInteractorId);
    }
    return undefined;
  }
}
