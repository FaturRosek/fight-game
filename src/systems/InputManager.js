import Phaser from "phaser";
import { KEY_BINDINGS } from "../config/gameData.js";

const NATIVE_CODE_MAP = {
  W: ["KeyW", "w", "W"],
  A: ["KeyA", "a", "A"],
  S: ["KeyS", "s", "S"],
  D: ["KeyD", "d", "D"],
  F: ["KeyF", "f", "F"],
  G: ["KeyG", "g", "G"],
  H: ["KeyH", "h", "H"],
  R: ["KeyR", "r", "R"],
  UP: ["ArrowUp", "Up"],
  DOWN: ["ArrowDown", "Down"],
  LEFT: ["ArrowLeft", "Left"],
  RIGHT: ["ArrowRight", "Right"],
  J: ["KeyJ", "j", "J"],
  K: ["KeyK", "k", "K"],
  L: ["KeyL", "l", "L"],
  I: ["KeyI", "i", "I"],
};

export default class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.keyboard = scene.input.keyboard;
    this.keyboard.enabled = true;

    if (scene.game && scene.game.canvas) {
      scene.game.canvas.setAttribute("tabindex", "0");
      scene.game.canvas.focus();
    }

    this.pressedCodes = new Set();
    this.justPressedCodes = new Set();

    this.p1Keys = this.mapPlayerKeys(KEY_BINDINGS.player1);
    this.p2Keys = this.mapPlayerKeys(KEY_BINDINGS.player2);

    this.handleKeyDown = (event) => {
      const code = event.code || event.key;
      if (
        code === "ArrowUp" ||
        code === "ArrowDown" ||
        code === "ArrowLeft" ||
        code === "ArrowRight" ||
        code === "Space"
      ) {
        event.preventDefault();
      }

      if (!this.pressedCodes.has(code)) {
        this.justPressedCodes.add(code);
      }
      this.pressedCodes.add(code);
      if (event.key) {
        if (!this.pressedCodes.has(event.key)) {
          this.justPressedCodes.add(event.key);
        }
        this.pressedCodes.add(event.key);
      }
    };

    this.handleKeyUp = (event) => {
      const code = event.code || event.key;
      this.pressedCodes.delete(code);
      if (event.key) {
        this.pressedCodes.delete(event.key);
        this.pressedCodes.delete(event.key.toLowerCase());
        this.pressedCodes.delete(event.key.toUpperCase());
      }
    };

    this.handleWindowBlur = () => {
      this.pressedCodes.clear();
      this.justPressedCodes.clear();
    };

    window.addEventListener("keydown", this.handleKeyDown, { passive: false });
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleWindowBlur);

    scene.events.once("shutdown", () => this.destroy());
    scene.events.once("destroy", () => this.destroy());
  }

  mapPlayerKeys(bindingConfig) {
    const mapped = {};
    Object.keys(bindingConfig).forEach((action) => {
      const keyName = bindingConfig[action];
      const code = Phaser.Input.Keyboard.KeyCodes[keyName];
      mapped[action] = {
        keyName,
        phaserKey: this.keyboard
          ? this.keyboard.addKey(code, false, false)
          : null,
      };
    });
    return mapped;
  }

  isActionHeld(actionObj) {
    if (actionObj.phaserKey && actionObj.phaserKey.isDown) {
      return true;
    }
    const candidates = NATIVE_CODE_MAP[actionObj.keyName] || [
      actionObj.keyName,
    ];
    for (let i = 0; i < candidates.length; i++) {
      if (this.pressedCodes.has(candidates[i])) {
        return true;
      }
    }
    return false;
  }

  isActionJustPressed(actionObj) {
    if (
      actionObj.phaserKey &&
      Phaser.Input.Keyboard.JustDown(actionObj.phaserKey)
    ) {
      return true;
    }
    const candidates = NATIVE_CODE_MAP[actionObj.keyName] || [
      actionObj.keyName,
    ];
    for (let i = 0; i < candidates.length; i++) {
      if (this.justPressedCodes.has(candidates[i])) {
        this.justPressedCodes.delete(candidates[i]);
        return true;
      }
    }
    return false;
  }

  getPlayerState(playerNumber) {
    const keys = playerNumber === 1 ? this.p1Keys : this.p2Keys;
    const left = this.isActionHeld(keys.left);
    const right = this.isActionHeld(keys.right);
    const up = this.isActionHeld(keys.up);
    const down = this.isActionHeld(keys.down);

    return {
      left,
      right,
      up,
      down,
      jumpPressed: this.isActionJustPressed(keys.up),
      punchPressed: this.isActionJustPressed(keys.punch),
      kickPressed: this.isActionJustPressed(keys.kick),
      specialPressed: this.isActionJustPressed(keys.special),
      blockHeld: this.isActionHeld(keys.block),
    };
  }

  clearJustPressed() {
    this.justPressedCodes.clear();
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleWindowBlur);
  }
}
