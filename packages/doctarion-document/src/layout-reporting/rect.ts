/**
 * This intentionally looks exactly like the ClientRect you get from calling
 * getBoundingClientRect() and friends in browser javascript.
 *
 * From the point of view of the editor and all related code, the units for
 * these numbers dont matter (css pixels or raw pixels or whatever).
 *
 * To be clear the x axis is expected to start at 0 on the left and increase
 * towards the right. Teh y axis is expected to start at 0 at the top of teh
 * document and increase towards the bottom.
 */
export interface LayoutRect {
  readonly bottom: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly width: number;
}
