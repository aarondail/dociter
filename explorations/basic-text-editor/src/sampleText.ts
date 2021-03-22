export const SAMPLE = `
import * as PIXI from "pixi.js";

import {
  TileModel,
  TileType,
  TileRoadType,
  TileStructureType,
  TileStructureArchVariant,
  TileStructureLevel,
} from "../models/TileModel";

import { EditorState } from "./EditorState";
import { determineActualRoads } from "../models/utils";
import {GridType} from "../models/Hexgrid";

const tileTypeKeys = new Set(Object.keys(TileType));

export class GridEditor {
  public editorState: EditorState;

  private mouseDown: boolean;
  private targetTile?: TileModel;
  private appliedEffectForCurrentTile: boolean;
  private expandoBrushClickCounter: number;

  public constructor(
    private readonly grid: GridType,
    private readonly interaction: PIXI.interaction.InteractionManager,
    private readonly notifyTileChanged: (tileModel: TileModel) => void,
    private readonly fireTileHighlightChanged: (tileModel: TileModel, highlight: boolean) => void
  ) {
    this.expandoBrushClickCounter = 0;
    // Should get overriden
    this.editorState = {
      effect: "pan",
      brushType: 1,
    };
    this.mouseDown = false;
    this.appliedEffectForCurrentTile = false;
  }

  public onPressStart = (event: MouseEvent | TouchEvent) => {
    const e = event as MouseEvent; // TODO fix this
    if (e.button !== 0) {
      return undefined;
    }

    if (this.editorState.effect === "pan") {
      return undefined;
    }

    const point = new PIXI.Point(e.clientX, e.clientY);
    const g = this.interaction.hitTest(point);

    if (g) {
      e.preventDefault();
      this.mouseDown = true;
      this.switchActiveTargetTile((g as any)?.correspondingTileRenderer?.currentTile);
      this.applyEffect();
      this.appliedEffectForCurrentTile = true;
    }

    return "capture";
  };

  public onPressMove = (event: MouseEvent | TouchEvent) => {
    const e = event as MouseEvent; // TODO fix

    const point = new PIXI.Point(e.clientX, e.clientY);
    const g = this.interaction.hitTest(point);
    this.switchActiveTargetTile((g as any)?.correspondingTileRenderer?.currentTile);

    if (this.targetTile && this.mouseDown && !this.appliedEffectForCurrentTile) {
      this.applyEffect();
      this.appliedEffectForCurrentTile = true;
    }

    return undefined;
  };

  public onHover = (event: MouseEvent | TouchEvent) => {
    const e = event as MouseEvent;
    const point = new PIXI.Point(e.clientX, e.clientY);
    const g = this.interaction.hitTest(point);
    this.switchActiveTargetTile((g as any)?.correspondingTileRenderer?.currentTile);
  };

  public onPressEnd = (event: MouseEvent | TouchEvent) => {
    const e = event as MouseEvent;
    this.mouseDown = false;
    const point = new PIXI.Point(e.clientX, e.clientY);
    const g = this.interaction.hitTest(point);
    this.switchActiveTargetTile((g as any)?.correspondingTileRenderer?.currentTile);
    this.appliedEffectForCurrentTile = false;
  };

  public onPressCancel = () => {
    this.switchActiveTargetTile(undefined);
  };

  private applyEffect() {
    const tile = this.targetTile;
    if (!tile) {
      return;
    }

    if (this.editorState.brushType === 1 || this.editorState.brushType === 2) {
      this.applyEffectPrime(tile);
      if (this.editorState.brushType === 2) {
        this.targetTile?.neighbors.forEach((x) => x && this.applyEffectPrime(x));
      }
    } else if (this.editorState.brushType === 3) {
      this.grid.hexesInRange(tile.hex, 3, true).forEach( hex => {
        hex.tile && this.applyEffectPrime(hex.tile);
      });
    } else if (this.editorState.brushType === "expando") {
      const e = ++this.expandoBrushClickCounter;
      this.grid.hexesInRange(tile.hex, e, true).forEach( hex => {
        const dist = tile.hex.distance(hex);
        if (dist === e - 1) {
          hex.tile && this.applyEffectPrime(hex.tile);
        }
      });
    }
  }

  private applyEffectPrime(tile: TileModel) {
    const effect = this.editorState.effect;

    if (effect === "lower") {
      tile.z--;
    } else if (tileTypeKeys.has(effect)) {
      tile.type = effect as TileType;
    } else if (effect === "raise") {
      tile.z++;
    } else if (effect === "height0") {
      tile.z = 0;
    } else if (effect === "height1") {
      tile.z = 1;
    } else if (effect === "height2") {
      tile.z = 2;
    } else if (effect === "height3") {
      tile.z = 3;
    } else if (effect === "height4") {
      tile.z = 4;
    } else if (effect === "height5") {
      tile.z = 5;
    } else if (effect === "height6") {
      tile.z = 6;
    } else if (effect === "height7") {
      tile.z = 7;
    } else if (effect === "height8") {
      tile.z = 8;
    } else if (effect === "hill") {
      if (tile.doodad === "hill1") {
        tile.doodad = "hill2";
      } else {
        tile.doodad = "hill1";
      }
    } else if (effect === "rocks") {
      if (tile.doodad === "rocks1") {
        tile.doodad = "rocks2";
      } else {
        tile.doodad = "rocks1";
      }
    } else if (effect === "volcanoLava") {
      tile.doodad = effect;
    } else if (effect === "caldera") {
      tile.doodad = effect;
    } else if (effect === "volcanoVent") {
      tile.doodad = effect;
    } else if (effect === "mountains") {
      if (tile.doodad?.startsWith("mountains_")) {
        let i = parseInt(tile.doodad.substring(10));
        i++;
        if (i > 7) {
          i = 1;
        }
        tile.doodad = "mountains_" + i;
      } else {
        tile.doodad = "mountains_1";
      }
    } else if (effect === "road") {
      tile.explicitRoadType = TileRoadType.SMALL_ROAD;
      this.updateRoadsAroundTile(tile);
    } else if (effect === "highway") {
      tile.structure = undefined;
      tile.structureLevel = undefined;
      tile.structureArchVariant = undefined;
      tile.structureMinorVariant = undefined;
      tile.explicitRoadType = TileRoadType.BIG_ROAD;
      this.updateRoadsAroundTile(tile);
    } else if (effect === "railroad") {
      tile.explicitRoadType = TileRoadType.RAILROAD;
      this.updateRoadsAroundTile(tile);
    } else if (effect === "smallTown") {
      tile.doodad = undefined;
      if (tile.structure === TileStructureType.TOWN) {
        tile.structureMinorVariant = ((tile.structureMinorVariant || 0) + 1) % 3;
      } else {
        tile.structure = TileStructureType.TOWN;
        tile.structureMinorVariant = 0;
        this.updateRoadsAroundTile(tile);
      }
    } else if (effect === "farm") {
      tile.doodad = undefined;
      if (tile.structure === TileStructureType.FARM) {
        tile.structureMinorVariant = ((tile.structureMinorVariant || 0) + 1) % 3;
      } else {
        tile.structure = TileStructureType.FARM;
        tile.structureMinorVariant = 0;
        this.updateRoadsAroundTile(tile);
      }
    } else if (effect === "cityStyle1") {
      tile.doodad = undefined;
      if (tile.structure === TileStructureType.CITY && tile.structureArchVariant === TileStructureArchVariant.STYLE_1) {
        tile.structureLevel = ((tile.structureLevel || 0) + 1) as TileStructureLevel;
        if (tile.structureLevel > 10) {
          tile.structureLevel = 10;
        }
      } else {
        tile.structure = TileStructureType.CITY;
        tile.structureArchVariant = TileStructureArchVariant.STYLE_1;
        tile.structureMinorVariant = undefined;
        tile.structureLevel = 1;
        this.updateRoadsAroundTile(tile);
      }
    } else if (effect === "cityStyle2") {
      tile.doodad = undefined;
      if (tile.structure === TileStructureType.CITY && tile.structureArchVariant === TileStructureArchVariant.STYLE_2) {
        tile.structureLevel = ((tile.structureLevel || 0) + 1) as TileStructureLevel;
        if (tile.structureLevel > 10) {
          tile.structureLevel = 10;
        }
      } else {
        tile.structure = TileStructureType.CITY;
        tile.structureArchVariant = TileStructureArchVariant.STYLE_2;
        tile.structureMinorVariant = undefined;
        tile.structureLevel = 1;
        this.updateRoadsAroundTile(tile);
      }
    } else if (effect === "cityStyle3") {
      tile.doodad = undefined;
      if (tile.structure === TileStructureType.CITY && tile.structureArchVariant === TileStructureArchVariant.STYLE_3) {
        tile.structureLevel = ((tile.structureLevel || 0) + 1) as TileStructureLevel;
        if (tile.structureLevel > 10) {
          tile.structureLevel = 10;
        }
      } else {
        tile.structure = TileStructureType.CITY;
        tile.structureArchVariant = TileStructureArchVariant.STYLE_3;
        tile.structureMinorVariant = undefined;
        tile.structureLevel = 1;
        this.updateRoadsAroundTile(tile);
      }
    } else if (effect === "trainStation") {
      tile.doodad = undefined;
      tile.structure = TileStructureType.TRAIN_STATION;
      tile.structureArchVariant = undefined;
      tile.structureMinorVariant = undefined;
      tile.structureLevel = 1;
      this.updateRoadsAroundTile(tile);
    } else if (
      effect === "cedarTrees" ||
      effect === "yellowTrees" ||
      effect === "greenTrees" ||
      effect === "jungleTrees" ||
      effect === "africanTrees"
    ) {
      let av = TileStructureArchVariant.STYLE_1;
      if (effect === "cedarTrees") {
        av = TileStructureArchVariant.STYLE_1;
      } else if (effect === "yellowTrees") {
        av = TileStructureArchVariant.STYLE_2;
      } else if (effect === "greenTrees") {
        av = TileStructureArchVariant.STYLE_3;
      } else if (effect === "jungleTrees") {
        av = TileStructureArchVariant.STYLE_4;
      } else if (effect === "africanTrees") {
        av = TileStructureArchVariant.STYLE_5;
      }

      tile.doodad = undefined;
      if (
        tile.structure === TileStructureType.TREES &&
        tile.structureArchVariant ===av
      ) {
        if (effect !== "africanTrees" && effect !== "jungleTrees") {


          
           

        tile.structureLevel = ((tile.structureLevel || 0) + 1) as TileStructureLevel;
        if (tile.structureLevel > 2) {
          tile.structureLevel = 1;
        }
        }
      } else {
        tile.structure = TileStructureType.TREES;
        tile.structureArchVariant = av;
        tile.structureMinorVariant = undefined;
        tile.structureLevel = 1;
        this.updateRoadsAroundTile(tile);
      }
    } else if (effect === "buildings1") {
      tile.doodad = effect;
    } else if (effect === "buildings2") {
      tile.doodad = effect;
    } else if (effect === "buildings3") {
      if (tile.doodad?.startsWith("buildings3_")) {
        let i = parseInt(tile.doodad.substring(11));
        i++;
        if (i > 8) {
          i = 1;
        }
        tile.doodad = "buildings3_" + i;
      } else {
        tile.doodad = "buildings3_1";
      }
    } else if (effect === "trees1") {
      tile.doodad = effect;
    } else if (effect === "trees2") {
      tile.doodad = effect;
    } else if (effect === "trees3") {
      if (tile.doodad?.startsWith("trees3_")) {
        let i = parseInt(tile.doodad.substring(7));
        i++;
        if (i > 4) {
          i = 1;
        }
        tile.doodad = "trees3_" + i;
      } else {
        tile.doodad = "trees3_1";
      }
    } else if (effect === "doraimon") {
      tile.doodad = effect;
    } else if (effect === "maisan") {
      tile.doodad = effect;
    } else if (effect === "dinosaurs") {
      if (tile.doodad === "dinosaurs1") {
        tile.doodad = "dinosaurs2";
      } else if (tile.doodad === "dinosaurs2") {
        tile.doodad = "dinosaurs3";
      } else if (tile.doodad === "dinosaurs3") {
        tile.doodad = "dinosaurs1";
      } else {
        tile.doodad = "dinosaurs1";
      }
    } else if (effect === "cats") {
      if (tile.doodad === "cats1") {
        tile.doodad = "cats2";
      } else if (tile.doodad === "cats2") {
        tile.doodad = "cats3";
      } else if (tile.doodad === "cats3") {
        tile.doodad = "cats1";
      } else {
        tile.doodad = "cats1";
      }
    } else if (effect === "helper") {
      tile.doodad = effect;
    } else if (effect === "clear") {
      tile.doodad = undefined;
      tile.explicitRoadType = undefined;
      tile.structure = undefined;
      tile.structureArchVariant = undefined;
      tile.structureLevel = undefined;
      tile.structureMinorVariant = undefined;

      this.updateRoadsAroundTile(tile);
    }

    this.notifyTileChanged(tile);
  }

  private switchActiveTargetTile = (tile?: TileModel) => {
    if (this.targetTile && (!tile || this.targetTile !== tile)) {
      this.fireTileHighlightChanged(this.targetTile, false);
      // JIC
      this.targetTile.neighbors.forEach((x) => x && this.fireTileHighlightChanged(x, false));
    }
    if (tile !== this.targetTile) {
      this.expandoBrushClickCounter = 0;
      this.appliedEffectForCurrentTile = false;
    }
    this.targetTile = tile;
    if (this.targetTile) {
      this.fireTileHighlightChanged(this.targetTile, true);
      if (this.editorState.brushType === 2) {
        tile?.neighbors.forEach((x) => x && this.fireTileHighlightChanged(x, true));
      }
    }
  };

  private updateRoadsAroundTile(tile: TileModel) {
    tile.actualRoads = determineActualRoads(tile);
    tile.neighbors.forEach((n) => {
      if (n) {
        n.actualRoads = determineActualRoads(n);
      }
    });
  }
}
`;
