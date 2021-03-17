import React from "react";

import { ThreeJsApp } from "./ThreeJsApp";

function App(): JSX.Element {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const threeJsContainerRef = React.useRef<ThreeJsApp | null>(null);

  const setCanvas = React.useCallback((e: HTMLCanvasElement | null) => {
    if (threeJsContainerRef.current) {
      threeJsContainerRef.current.dispose();
      threeJsContainerRef.current = null;
    }
    canvasRef.current = e;
    if (canvasRef.current) {
      threeJsContainerRef.current = new ThreeJsApp(canvasRef.current);
    }
  }, []);

  return <canvas id="canvas" ref={setCanvas} />;
}

export default App;
