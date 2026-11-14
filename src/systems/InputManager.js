import Phaser from "phaser";
import { KEY_BINDINGS, COMBAT_CONFIG } from "../config/gameData.js";

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
  J: ["KeyJ", "j", "J", "Numpad1", "Digit1", "1"],
  K: ["KeyK", "k", "K", "Numpad2", "Digit2", "2"],
  L: ["KeyL", "l", "L", "Numpad3", "Digit3", "3"],
  I: ["KeyI", "i", "I", "Numpad0", "Digit0", "0"],
};

const GAME_CODES = new Set(Object.values(NATIVE_CODE_MAP).flat());

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

    this.p1Buffer = { jump: 0, punch: 0, kick: 0, special: 0 };
    this.p2Buffer = { jump: 0, punch: 0, kick: 0, special: 0 };

    this.touchControls = null;
    this.p1Keys = this.mapPlayerKeys(KEY_BINDINGS.player1);
    this.p2Keys = this.mapPlayerKeys(KEY_BINDINGS.player2);

    this.handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const code = event.code || event.key;

      if (
        GAME_CODES.has(code) ||
        GAME_CODES.has(event.key) ||
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
      this.resetBuffers();
    };

    window.addEventListener("keydown", this.handleKeyDown, { passive: false });
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleWindowBlur);

    scene.events.once("shutdown", () => this.destroy());
    scene.events.once("destroy", () => this.destroy());
  }

  resetBuffers() {
    Object.keys(this.p1Buffer).forEach((k) => {
      this.p1Buffer[k] = 0;
    });
    Object.keys(this.p2Buffer).forEach((k) => {
      this.p2Buffer[k] = 0;
    });
  }

  attachTouchControls(touchControls) {
    this.touchControls = touchControls;
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

  checkRawJustPressed(actionObj) {
    let triggered = false;
    if (
      actionObj.phaserKey &&
      Phaser.Input.Keyboard.JustDown(actionObj.phaserKey)
    ) {
      triggered = true;
    }
    const candidates = NATIVE_CODE_MAP[actionObj.keyName] || [
      actionObj.keyName,
    ];
    for (let i = 0; i < candidates.length; i++) {
      if (this.justPressedCodes.has(candidates[i])) {
        this.justPressedCodes.delete(candidates[i]);
        triggered = true;
      }
    }
    return triggered;
  }

  getPlayerState(playerNumber, deltaMs = 16.67) {
    const safeDelta = deltaMs > 0 ? Math.min(deltaMs, 50) : 16.67;
    const keys = playerNumber === 1 ? this.p1Keys : this.p2Keys;
    const buffer = playerNumber === 1 ? this.p1Buffer : this.p2Buffer;
    const bufferWindow = COMBAT_CONFIG.inputBufferWindowMs || 130;
    const touch = playerNumber === 1 ? this.touchControls : null;

    Object.keys(buffer).forEach((k) => {
      if (buffer[k] > 0) {
        buffer[k] = Math.max(0, buffer[k] - safeDelta);
      }
    });

    const touchJumpPressed = touch ? touch.consumeJustPressed('up') : false;
    const touchPunchPressed = touch ? touch.consumeJustPressed('punch') : false;
    const touchKickPressed = touch ? touch.consumeJustPressed('kick') : false;
    const touchSpecPressed = touch ? touch.consumeJustPressed('special') : false;

    if (this.checkRawJustPressed(keys.up) || touchJumpPressed) buffer.jump = bufferWindow;
    if (this.checkRawJustPressed(keys.punch) || touchPunchPressed) buffer.punch = bufferWindow;
    if (this.checkRawJustPressed(keys.kick) || touchKickPressed) buffer.kick = bufferWindow;
    if (this.checkRawJustPressed(keys.special) || touchSpecPressed) buffer.special = bufferWindow;

    const left = this.isActionHeld(keys.left) || Boolean(touch && touch.isHeld('left'));
    const right = this.isActionHeld(keys.right) || Boolean(touch && touch.isHeld('right'));
    const up = this.isActionHeld(keys.up) || Boolean(touch && touch.isHeld('up'));
    const down = this.isActionHeld(keys.down) || Boolean(touch && touch.isHeld('down'));
    const blockHeld = this.isActionHeld(keys.block) || Boolean(touch && touch.isHeld('block'));

    return {
      left,
      right,
      up,
      down,
      jumpPressed: buffer.jump > 0,
      punchPressed: buffer.punch > 0,
      kickPressed: buffer.kick > 0,
      specialPressed: buffer.special > 0,
      blockHeld,
      consumeAction: (actionName) => {
        if (buffer[actionName] !== undefined) {
          buffer[actionName] = 0;
        }
      }
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
