import * as THREE from "three";

import { PixelViewPort } from "./PixelViewPort";

export class MainContainer extends THREE.Object3D {
  public constructor(private vp: PixelViewPort) {
    super();

    /*
    1: This should contain the periodic table
    2: And bubbles
    3: And light?

    In terms of the scene, perhaps we layout from 0,0 to 1,1 (bl to tr)?
    Maybe switch to -1,-1 to 1,1 at some point

    */

    const geo = new THREE.SphereBufferGeometry(0.3, 64, 32);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const makeSphere = (x: number, y: number, color: any, scale?: number) => {
      const mat = new THREE.MeshStandardMaterial({
        color,
        metalness: 1,
        roughness: 0.8,
        transparent: true,
        // opacity: 0.5,
        // emissive: 0x333333,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, Math.random() * -1);
      const s = scale ?? 1.0; // Math.random() * 0.4 + 0.6;
      mesh.scale.set(s, s, s);
      this.add(mesh);
    };

    makeSphere(0, 0, "red");
    makeSphere(1, 1, "blue");
    makeSphere(1 / 2, 1 / 2, "green");
    makeSphere(0, 1, "grey");
    makeSphere(-2, 0, 0x999999); // 0x123456 0 1 2 3 4 5 6 7 8 9 A B C D E F
    makeSphere(-1, -1, "blue");
    makeSphere(-1 / 2, -1 / 2, "green");
    makeSphere(0, -1, "grey", 3.3);
    makeSphere(-1, 0, 0xffff00, 2.9);
    makeSphere(-3, -2, "blue");
    makeSphere(-3 / 2, -3 / 2, "green", 4.2);
    makeSphere(0, -3, "magenta");
    for (let i = -3; i <= 3; i += 1) {
      makeSphere(i, i, 0x33aaff, 2.1);
      makeSphere(i, -1 * i, 0xffaa33);
    }

    const l1 = new THREE.DirectionalLight(0xffffff, 9.9);
    l1.position.set(-1000, 0, 1000);
    this.add(l1);
    const l2 = new THREE.AmbientLight(0xffffff, 0.5);
    this.add(l2);
  }

  public dispose(): void {
    // TODO?
  }

  public animate(deltaS: number): void {
    // TODO
  }

  public relayout(): void {
    // TODO?
  }
}
