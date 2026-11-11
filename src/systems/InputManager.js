import Phaser from "phaser";
import { KEY_BINDINGS } from "../config/gameData.js";

export default class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.keyboard = scene.input.keyboard;
    this.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.F,
      Phaser.Input.Keyboard.KeyCodes.G,
      Phaser.Input.Keyboard.KeyCodes.H,
      Phaser.Input.Keyboard.KeyCodes.R,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.J,
      Phaser.Input.Keyboard.KeyCodes.K,
      Phaser.Input.Keyboard.KeyCodes.L,
      Phaser.Input.Keyboard.KeyCodes.I,
    ]);

    this.p1Keys = this.mapPlayerKeys(KEY_BINDINGS.player1);
    this.p2Keys = this.mapPlayerKeys(KEY_BINDINGS.player2);
  }

  mapPlayerKeys(bindingConfig) {
    const mapped = {};
    Object.keys(bindingConfig).forEach((action) => {
      const code = Phaser.Input.Keyboard.KeyCodes[bindingConfig[action]];
      mapped[action] = this.keyboard.addKey(code, true, false);
    });
    return mapped;
  }

  getPlayerState(playerNumber) {
    const keys = playerNumber === 1 ? this.p1Keys : this.p2Keys;
    return {
      left: keys.left.isDown,
      right: keys.right.isDown,
      up: keys.up.isDown,
      down: keys.down.isDown,
      jumpPressed: Phaser.Input.Keyboard.JustDown(keys.up),
      punchPressed: Phaser.Input.Keyboard.JustDown(keys.punch),
      kickPressed: Phaser.Input.Keyboard.JustDown(keys.kick),
      specialPressed: Phaser.Input.Keyboard.JustDown(keys.special),
      blockHeld: keys.block.isDown,
    };
  }
}
