import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import { MainContainer } from "./MainContainer";
import { PixelViewPort } from "./PixelViewPort";
import { Stats } from "./Stats";

export class ThreeJsApp {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private stats: Stats;
  private mainContainer: MainContainer;
  private vpInfo: PixelViewPort;
  private clock: THREE.Clock;
  private disposed: boolean;
  private controls: OrbitControls;

  public constructor(private readonly canvas: HTMLCanvasElement) {
    this.disposed = false;
    this.stats = new Stats();
    this.renderer = new THREE.WebGLRenderer({ canvas });
    this.renderer.setClearColor(0x000000);
    this.renderer.physicallyCorrectLights = true;
    this.renderer.info.autoReset = true; // Makes better stats I think
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.camera = new THREE.PerspectiveCamera(40, 2, 0.1, 50000);
    this.camera.position.set(0, 0, 5);
    this.vpInfo = {
      pixelWidth: canvas.clientWidth * window.devicePixelRatio,
      pixelHeight: canvas.clientHeight * window.devicePixelRatio,
      cssPixelRatio: window.devicePixelRatio,
    };
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.3;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.controls.enablePan = true;
    this.controls.enableKeys = true;
    this.controls.keyPanSpeed = 1000.0;
    this.controls.keys = {
      LEFT: 37, //left arrow
      UP: 38, // up arrow
      RIGHT: 39, // right arrow
      BOTTOM: 40, // down arrow
    };
    this.controls.update();

    this.mainContainer = new MainContainer(this.vpInfo);
    this.updateRendererSize(true);
    this.scene.add(
      new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshStandardMaterial({ color: 0x0088ff }))
    );
    this.scene.add(this.mainContainer);
    requestAnimationFrame(this.animate);
  }

  public dispose(): void {
    this.disposed = true;
    this.renderer.dispose();
    this.stats.dispose();
    this.mainContainer.dispose();
  }

  private animate = () => {
    if (this.disposed) {
      return;
    }

    this.stats.begin();
    this.updateRendererSize();
    this.controls.update();
    this.mainContainer.animate(this.clock.getDelta());
    this.renderer.render(this.scene, this.camera);
    this.stats.end(this.renderer);
    this.renderer.info.reset();
    requestAnimationFrame(this.animate);
  };

  private updateRendererSize(force?: boolean): void {
    const pw = this.canvas.clientWidth * window.devicePixelRatio;
    const ph = this.canvas.clientHeight * window.devicePixelRatio;

    if (this.canvas.width !== pw || this.canvas.height !== ph || force) {
      this.vpInfo.cssPixelRatio = window.devicePixelRatio;
      this.vpInfo.pixelWidth = pw;
      this.vpInfo.pixelHeight = ph;

      this.mainContainer.relayout();
      this.renderer.setSize(pw, ph, false);
      this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
      this.camera.updateProjectionMatrix();
    }
  }
}
