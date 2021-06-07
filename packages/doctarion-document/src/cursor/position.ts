import { Path, PathString } from "../basic-traversal";

import { Cursor, CursorOrientation } from "./cursor";

export type CursorPosition = Cursor | { path: Path | PathString; orientation: CursorOrientation };

export const CursorPosition = {
  toCursor(position: CursorPosition): Cursor {
    if (position instanceof Cursor) {
      return position;
    }
    return new Cursor(position.path instanceof Path ? position.path : Path.parse(position.path), position.orientation);
  },
};
