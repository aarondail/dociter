import * as DoctarionDocument from "doctarion-document";
import React from "react";

import "./Cursor.css";
import { isElementInViewport } from "./utils";

export interface CursorPosition {
  left: number;
  top: number;
  height: number;
}

// TODO maybe make this use EditorService
/**
 * Definitely breaking React conventions here... mainly due to the
 * layoutService being mutable (so changes to it won't cause re-renders) _and_
 * the fact that layoutService is effectively populated/usable only _after_
 * React has created DOM elements for the DocumentNodes.
 */
export class Cursor extends React.PureComponent {
  // Breaking react conventions a little bit here too... to force the CSS
  // animation to reset when we re-render
  private animationFlipper = "1";
  private position?: CursorPosition;
  private ref = React.createRef<HTMLDivElement>();

  public componentDidUpdate(): void {
    if (this.ref.current) {
      if (!isElementInViewport(this.ref.current)) {
        this.ref.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }

  /**
   * This is necessary because the layoutService is a _mutable_ object. When it
   * is updated (due to the page being resized, or to new DocumentNodes being
   * rendered) this has to be called so that the cursor will be repositioned;
   */
  public layout(
    cursor: DoctarionDocument.Cursor,
    document: DoctarionDocument.Document,
    layoutService: DoctarionDocument.EditorNodeLayoutService
  ): CursorPosition | undefined {
    this.position = Cursor.calculatePosition(cursor, document, layoutService);
    // console.log("Cursor pos", this.position);

    if (this.animationFlipper === "1") {
      this.animationFlipper = "2";
    } else {
      this.animationFlipper = "1";
    }

    this.forceUpdate();
    return this.position;
  }

  public render = (): JSX.Element | null => {
    if (!this.position) {
      return null;
    }

    return (
      <div
        ref={this.ref}
        className={`Cursor-cursor Cursor-cursor-blink${this.animationFlipper}`}
        style={this.position}
      ></div>
    );
  };

  private static calculatePosition(
    cursor: DoctarionDocument.Cursor,
    document: DoctarionDocument.Document,
    layoutService: DoctarionDocument.EditorNodeLayoutService
  ): undefined | CursorPosition {
    const chain = DoctarionDocument.Chain.from(document, cursor.at);
    if (!chain) {
      return undefined;
    }
    const rect = layoutService.getLayout(chain);
    // console.log("Cursor.tsx", rect);
    if (!rect) {
      return undefined;
    }

    const w = 2;
    const isLeft = cursor?.affinity === DoctarionDocument.CursorAffinity.Before;
    const left = isLeft ? rect.left - 1 : rect.right - w;
    const top = rect.top;
    const height = rect.height;
    return { left, top, height };
  }
}
