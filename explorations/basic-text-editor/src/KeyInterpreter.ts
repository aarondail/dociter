import * as DD from "doctarion-document";

export class KeyInterpreter {
  private ignoreFurtherPressesUntilNoPresses: boolean;
  private keyPressTimes: Map<string, number>;

  public constructor(private editor: DD.Editor) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.keyPressTimes = new Map();
    this.ignoreFurtherPressesUntilNoPresses = false;
  }

  public compositionEnd(e: React.CompositionEvent<HTMLTextAreaElement>): void {
    console.log("onCompositionEnd", e.nativeEvent);
    e.preventDefault();
    e.stopPropagation();
  }

  public compositionStart(e: React.CompositionEvent<HTMLTextAreaElement>): void {
    console.log("onCompositionStart", e.nativeEvent);
    e.preventDefault();
    e.stopPropagation();
  }

  public compositionUpdate(e: React.CompositionEvent<HTMLTextAreaElement>): void {
    console.log("onCompositionUpdate", e.nativeEvent);
    e.preventDefault();
    e.stopPropagation();
  }

  public input(e: React.FormEvent<HTMLTextAreaElement>): void {
    console.log("onInput", e.nativeEvent);
    e.preventDefault();
    e.stopPropagation();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const text = (e.nativeEvent as any).data;
    // if (this.editor.mode === EditorMode.EDIT && !this.ignoreFurtherPressesUntilNoPresses && text) {
    //   this.editor.execute(EditorCommand.insert(text));
    // }
  }

  public keyDown(e: React.KeyboardEvent<HTMLElement>): void {
    // Have to use e.nativeEvent.code instead of anything else because its one
    // of only two ways to properly ignore (AFAICT) when compositions happen.
    //
    // The problem (at least on Mac) try: ALT+` then i. If we look at the key or
    // even the which property we will get different info for the two events.
    // E.g. for key, for key down we get ì (note that is weird i) BUT for key up
    // it is just i!
    //
    // Alternatively we could continue to use key but maybe if composition
    // starts we can ignore things till its over? The other thing is this
    // apparently lets us differentiate AltLeft from AltRight... which is
    // interesting. Though there is also a location that seems like it works for
    // that.
    //
    // Maybe that is better but for now I'm going with this.

    this.keyPressTimes.set(e.nativeEvent.code, new Date().getTime());
    // Looks good to use: e.code (KeyA, MetaLeft) . ... that looks like it to me?
    console.log("keyDown: " + e.nativeEvent.code, this.keyPressTimes.keys());

    this.processKeys();

    // Can't do this here since it will block the input and composition events:
    // e.preventDefault();
    // e.stopPropagation();
  }

  public keyUp(e: React.KeyboardEvent<HTMLElement>): void {
    console.log("keyUp: " + e.nativeEvent.code, this.keyPressTimes.keys());
    this.keyPressTimes.delete(e.nativeEvent.code);
    if (this.keyPressTimes.size === 0) {
      this.ignoreFurtherPressesUntilNoPresses = false;
    }
  }

  private processKeys() {
    if (this.ignoreFurtherPressesUntilNoPresses) {
      return;
    }

    // let shift = false;
    // let altOrOption = false;
    // let metaOrCmd = false;
    // let ctrl = false;
    // const keys = [];
    // for (const key of this.keyPressTimes.entries()) {
    //   if (key[0] === "shift") {
    //     shift = true;
    //     continue;
    //   }
    //   if (key[0] === "AltLeft" || key[0] === "AltRight") {
    //     altOrOption = true;
    //     continue;
    //   }
    //   if (key[0] === "MetaLeft" || key[0] === "MetaRight") {
    //     metaOrCmd = true;
    //     continue;
    //   }
    //   if (key[0] === "ControlLeft" || key[0] === "ControlRight") {
    //     ctrl = true;
    //     continue;
    //   }
    //   keys.push(key[0]);
    // }
    // keys.sort();

    // if (this.editor.mode === EditorMode.COMMAND) {
    //   if (keys[0] === "KeyJ") {
    //     this.editor.execute(EditorCommand.moveCursorRelative(1, undefined));
    //   } else if (keys[0] === "KeyK") {
    //     this.editor.execute(EditorCommand.moveCursorRelative(-1, undefined));
    //   } else if (keys[0] === "KeyH") {
    //     this.editor.execute(EditorCommand.moveCursorRelative(undefined, -1));
    //   } else if (keys[0] === "KeyL") {
    //     this.editor.execute(EditorCommand.moveCursorRelative(undefined, 1));
    //   } else if (keys[0] === "KeyX") {
    //     this.editor.execute(EditorCommand.delete());
    //   } else if (keys[0] === "KeyZ") {
    //     if (ctrl || metaOrCmd) {
    //       if (!shift) {
    //         this.editor.execute(EditorCommand.undo());
    //       } else {
    //         this.editor.execute(EditorCommand.redo());
    //       }
    //     }
    //   } else if (keys[0] === "KeyA") {
    //     this.editor.execute(
    //       EditorCommand.switchMode(EditorMode.EDIT, { cursorEditOrientation: CursorEditOrientation.AFTER })
    //     );
    //     this.ignoreFurtherPressesUntilNoPresses = true;
    //   } else if (keys[0] === "KeyI") {
    //     this.editor.execute(
    //       EditorCommand.switchMode(EditorMode.EDIT, { cursorEditOrientation: CursorEditOrientation.BEFORE })
    //     );
    //     this.ignoreFurtherPressesUntilNoPresses = true;
    //   }
    // } else {
    //   if (keys[0] === "Backspace") {
    //     this.editor.execute(EditorCommand.delete());
    //   } else if (keys[0] === "Escape") {
    //     this.editor.execute(EditorCommand.switchMode(EditorMode.COMMAND));
    //     this.ignoreFurtherPressesUntilNoPresses = true;
    //   }
    // }
  }
}
