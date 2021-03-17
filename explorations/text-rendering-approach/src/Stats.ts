import * as THREE from "three";
import RawStats from "three/examples/jsm/libs/stats.module";

export class Stats {
  private stats: RawStats;
  private drawCallsPanel: RawStats.Panel;
  private trianglesPanel: RawStats.Panel;
  private texturesPanel: RawStats.Panel;
  private geometriesPanel: RawStats.Panel;

  public constructor() {
    this.stats = RawStats();
    this.drawCallsPanel = RawStats.Panel("DrawCls", "#efabab", "#344556");
    this.trianglesPanel = RawStats.Panel("DrawCls", "#efabab", "#344556");
    this.texturesPanel = RawStats.Panel("DrawCls", "#efabab", "#344556");
    this.geometriesPanel = RawStats.Panel("DrawCls", "#efabab", "#344556");

    this.stats.addPanel(this.drawCallsPanel);
    this.stats.addPanel(this.trianglesPanel);
    this.stats.addPanel(this.texturesPanel);
    this.stats.addPanel(this.geometriesPanel);
    this.stats.showPanel(0);

    document.body.appendChild(this.stats.dom);
  }

  public dispose(): void {
    document.body.removeChild(this.stats.dom);
  }

  public begin(): void {
    this.stats.begin();
  }

  public end(renderer: THREE.WebGLRenderer): void {
    this.stats.end();
    this.drawCallsPanel.update(renderer.info.render.calls, 0);
    this.trianglesPanel.update(renderer.info.render.triangles, 0);
    this.texturesPanel.update(renderer.info.memory.textures, 0);
    this.geometriesPanel.update(renderer.info.memory.geometries, 0);
  }
}
