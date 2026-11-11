import Phaser from "phaser";
import { CHARACTERS, ARENAS } from "../config/gameData.js";
import { buildCharacterTextures } from "../utils/spriteGenerator.js";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    const { width, height } = this.scale;
    const loadingText = this.add
      .text(width / 2, height / 2, "INITIALIZING 2.5D FIGHTER ENGINE...", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "28px",
        color: "#ffd60a",
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    this.load.on("loaderror", () => {});

    CHARACTERS.forEach((char) => {
      const paths = char.candidatePaths || [char.assetPath];
      paths.forEach((path, idx) => {
        this.load.image(`${char.textureKey}_raw_${idx}`, path);
      });
    });

    const loadedArenaKeys = new Set();
    ARENAS.forEach((arena) => {
      if (arena.assetPath && !loadedArenaKeys.has(arena.textureKey)) {
        this.load.image(arena.textureKey, arena.assetPath);
        loadedArenaKeys.add(arena.textureKey);
      }
    });

    this.load.on("complete", () => {
      loadingText.destroy();
    });
  }

  create() {
    buildCharacterTextures(this, CHARACTERS);
    this.scene.start("MenuScene");
  }
}
