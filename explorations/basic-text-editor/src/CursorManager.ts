import * as DoctarionDocument from "doctarion-document";

export class CursorManager {
  private cursorHTMLElement?: HTMLDivElement;

  public constructor(private readonly editor: DoctarionDocument.Editor, private readonly container: HTMLElement) {}

  public reset(): void {
    if (this.cursorHTMLElement) {
      this.container.removeChild(this.cursorHTMLElement);
      this.cursorHTMLElement = undefined;
    }
  }

  public update(): void {
    console.log("CursorManager::update()");
    const cursor = this.editor.cursor;
    const rect = this.determineCursorPosition(cursor);

    if (!rect && this.cursorHTMLElement) {
      this.container.removeChild(this.cursorHTMLElement);
      this.cursorHTMLElement = undefined;
      return;
    }

    console.log(rect);
    if (!rect) {
      return;
    }

    if (!this.cursorHTMLElement) {
      console.log("Creating element on", this.container);
      this.cursorHTMLElement = document.createElement("div");
      this.cursorHTMLElement.className = "dot";
      this.cursorHTMLElement.style.cssText = "position: 'absolute'";
      this.container.appendChild(this.cursorHTMLElement);

      // const img = document.createElement("img");
      // img.src = "/caret-attempt-1.png";
      // img.style.cssText = "width: 5px; height: 30px;";
      // this.cursorHTMLElement.appendChild(img);
    }

    if (this.cursorHTMLElement.className === "dot") {
      this.cursorHTMLElement.className = "dot-2";
    } else {
      this.cursorHTMLElement.className = "dot";
    }
    // TODO height
    const w = 3;
    const isLeft = cursor.affinity === DoctarionDocument.CursorAffinity.Before;
    this.cursorHTMLElement.style.cssText = `position: absolute; top: ${rect.top}px; left: ${
      isLeft ? rect.left - 1 : rect.right - w
    }px; height: ${
      rect.height
    }px; border: solid 1px #8229DE; width: ${1}px; background-color: #8229DE; border-radius: 4px;`;
  }
  //72ECF6 D242FF A51FF0

  private determineCursorPosition(cursor: DoctarionDocument.Cursor): ClientRect | undefined {
    const chain = DoctarionDocument.Chain.from(this.editor.document, cursor.at);
    if (!chain) {
      return undefined;
    }
    return this.editor.services.layout.getLayout(chain);
  }
}
// <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" preserveAspectRatio="xMidYMid meet" viewBox="0 0 640 640" width="640" height="640"><defs><path d="M340 340L260 340" id="a1ng3YhEM"/><path d="M360.13 520.25C319.16 519.43 299.16 512.77 300.13 500.25C299.96 235.42 299.96 95.42 300.13 80.25C300.29 65.07 320.14 58.43 359.65 60.31" id="bxBs3xbs0"/><path d="M240 520C280.96 519.18 300.96 512.52 300 500C300.17 235.18 300.17 95.18 300 80C299.83 64.82 279.99 58.18 240.47 60.06" id="f5TpxLupNg"/><path d="" id="b3rDVotvWY"/><path d="" id="dgR1vCqSF"/><path d="M239.87 519.75C280.84 518.93 300.84 512.27 299.87 499.75C300.04 234.93 300.04 94.93 299.87 79.75C299.71 64.58 279.86 57.93 240.35 59.81" id="bfsTaOvSv"/><path d="M360 520C319.04 519.18 299.04 512.52 300 500C299.83 235.18 299.83 95.18 300 80C300.17 64.82 320.01 58.18 359.53 60.06" id="bZiHSCdJn"/><path d="M339.87 339.75L259.87 339.75" id="hQ1JsZhP6"/></defs><g><g><g><use xlink:href="#a1ng3YhEM" opacity="1" fill-opacity="0" stroke="#000000" stroke-width="10" stroke-opacity="1"/></g></g><g><g><use xlink:href="#bxBs3xbs0" opacity="1" fill-opacity="0" stroke="#000000" stroke-width="10" stroke-opacity="1"/></g></g><g><g><use xlink:href="#f5TpxLupNg" opacity="1" fill-opacity="0" stroke="#000000" stroke-width="10" stroke-opacity="1"/></g></g><g><g><use xlink:href="#b3rDVotvWY" opacity="1" fill-opacity="0" stroke="#000000" stroke-width="10" stroke-opacity="1"/></g></g><g><g><use xlink:href="#dgR1vCqSF" opacity="1" fill-opacity="0" stroke="#000000" stroke-width="10" stroke-opacity="1"/></g></g><g><g><use xlink:href="#bfsTaOvSv" opacity="1" fill-opacity="0" stroke="#ffffff" stroke-width="4" stroke-opacity="1"/></g></g><g><g><use xlink:href="#bZiHSCdJn" opacity="1" fill-opacity="0" stroke="#ffffff" stroke-width="4" stroke-opacity="1"/></g></g><g><g><use xlink:href="#hQ1JsZhP6" opacity="1" fill-opacity="0" stroke="#ffffff" stroke-width="4" stroke-opacity="1"/></g></g></g></svg>
