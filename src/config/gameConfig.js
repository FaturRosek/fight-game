import Phaser from "phaser";
import BootScene from "../scenes/BootScene.js";
import MenuScene from "../scenes/MenuScene.js";
import CharacterScene from "../scenes/CharacterScene.js";
import ArenaScene from "../scenes/ArenaScene.js";
import OnlineLobbyScene from "../scenes/OnlineLobbyScene.js";
import BattleScene from "../scenes/BattleScene.js";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const gameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#09090d",
  input: {
    activePointers: 6,
    touch: {
      capture: true,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: true,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 1200 },
      debug: false,
    },
  },
  scene: [
    BootScene,
    MenuScene,
    CharacterScene,
    ArenaScene,
    OnlineLobbyScene,
    BattleScene,
  ],
};
