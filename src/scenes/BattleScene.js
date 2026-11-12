import Phaser from "phaser";
import Fighter from "../entities/Fighter.js";
import AIController from "../entities/AIController.js";
import InputManager from "../systems/InputManager.js";
import CombatSystem from "../systems/CombatSystem.js";
import EffectsManager from "../systems/EffectsManager.js";
import { soundManager } from "../systems/SoundManager.js";
import {
  GameSession,
  saveSettings,
  createArcadeButton,
} from "../utils/helpers.js";

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");
  }

  create() {
    const { width, height } = this.scale;
    const { arena, p1Character, p2Character, mode, settings } = GameSession;
    this.floorY = height * 0.84;
    this.showDebugBoxes = false;
    this.isPVE = mode === "PVE";

    this.renderPerspectiveArena(arena, width, height);
    this.renderTekkenHUD(p1Character, p2Character, width);

    this.effectsManager = new EffectsManager(this);

    this.fighter1 = new Fighter(this, {
      playerNumber: 1,
      characterData: p1Character,
      x: 370,
      groundY: this.floorY,
      facing: 1,
    });

    this.fighter2 = new Fighter(this, {
      playerNumber: 2,
      characterData: p2Character,
      x: width - 370,
      groundY: this.floorY,
      facing: -1,
    });

    this.inputManager = new InputManager(this);
    this.aiController = this.isPVE
      ? new AIController(
          this,
          this.fighter2,
          this.fighter1,
          settings.aiDifficulty,
        )
      : null;

    this.combatSystem = new CombatSystem(
      this,
      this.fighter1,
      this.fighter2,
      (hitEvent) => this.handleCombatHit(hitEvent),
    );

    this.debugGraphics = this.add.graphics();

    const modeHeadline = this.isPVE
      ? `MODE: PLAYER VS AI (${settings.aiDifficulty.toUpperCase()}) — P1 KEYS: [WASD + F,G,H,R]`
      : "MODE: PLAYER VS PLAYER — P1: [WASD + F,G,H,R]  |  P2: [ARROWS + J,K,L,I]";

    this.combatFeedText = this.add
      .text(width / 2, 108, modeHeadline, {
        fontSize: "13px",
        fontStyle: "bold",
        color: "#ffd60a",
        backgroundColor: "#000000cc",
        padding: { x: 12, y: 4 },
      })
      .setOrigin(0.5);

    this.movementDebugText = this.add
      .text(width / 2, 138, "RAMA X: 370   ||   JUN X: 910", {
        fontFamily: "monospace",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#30d158",
        backgroundColor: "#0a0a14dd",
        padding: { x: 14, y: 5 },
      })
      .setOrigin(0.5);

    this.input.on("pointerdown", () => {
      soundManager.ensureContext();
      if (this.game && this.game.canvas) {
        this.game.canvas.focus();
      }
    });

    this.buildBottomUtilityBar(width, height);
  }

  renderPerspectiveArena(arena, width, height) {
    const hasLoadedImage =
      this.textures.exists(arena.textureKey) &&
      this.textures.get(arena.textureKey).getSourceImage().width > 64;

    if (hasLoadedImage) {
      this.add
        .image(width / 2, height / 2, arena.textureKey)
        .setDisplaySize(width, height);
      const vignette = this.add.graphics();
      vignette.fillStyle(0x000000, 0.25);
      vignette.fillRect(0, 0, width, 110);
      return;
    }

    const horizonY = height * 0.56;
    const g = this.add.graphics();

    g.fillGradientStyle(arena.skyColor, arena.skyColor, 0x1e1318, 0x1e1318, 1);
    g.fillRect(0, 0, width, horizonY);

    g.fillGradientStyle(
      0x1b151e,
      0x1b151e,
      arena.floorColor,
      arena.floorColor,
      1,
    );
    g.fillRect(0, horizonY, width, height - horizonY);

    g.lineStyle(3, arena.accentColor, 0.75);
    g.lineBetween(0, horizonY, width, horizonY);
  }

  renderTekkenHUD(p1, p2, width) {
    const hud = this.add.graphics();
    this.barWidth = 454;
    this.barHeight = 22;
    const topY = 34;

    hud.fillStyle(0x1a0808, 0.92);
    hud.fillRect(60, topY, this.barWidth + 6, this.barHeight + 6);
    hud.fillRect(
      width - 66 - this.barWidth,
      topY,
      this.barWidth + 6,
      this.barHeight + 6,
    );

    this.p1HealthFill = this.add
      .rectangle(
        63 + this.barWidth,
        topY + 3 + this.barHeight / 2,
        this.barWidth,
        this.barHeight,
        0xffcc00,
      )
      .setOrigin(1, 0.5);

    this.p2HealthFill = this.add
      .rectangle(
        width - 63 - this.barWidth,
        topY + 3 + this.barHeight / 2,
        this.barWidth,
        this.barHeight,
        0xffcc00,
      )
      .setOrigin(0, 0.5);

    hud.lineStyle(3, 0xffd60a, 1);
    hud.strokeRect(60, topY, this.barWidth + 6, this.barHeight + 6);
    hud.strokeRect(
      width - 66 - this.barWidth,
      topY,
      this.barWidth + 6,
      this.barHeight + 6,
    );

    this.add.text(62, topY + 34, p1.name, {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: "26px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 5,
    });

    const p2DisplayTitle = this.isPVE ? `${p2.name} [AI]` : p2.name;
    this.add
      .text(width - 62, topY + 34, p2DisplayTitle, {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "26px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(1, 0);

    this.p1StateBadge = this.add.text(
      210,
      topY + 40,
      "STATE: IDLE  |  SP: READY",
      {
        fontSize: "13px",
        fontStyle: "bold",
        color: "#30d158",
        backgroundColor: "#000000aa",
        padding: { x: 8, y: 3 },
      },
    );

    this.p2StateBadge = this.add
      .text(width - 210, topY + 40, "STATE: IDLE  |  SP: READY", {
        fontSize: "13px",
        fontStyle: "bold",
        color: "#30d158",
        backgroundColor: "#000000aa",
        padding: { x: 8, y: 3 },
      })
      .setOrigin(1, 0);

    this.add
      .text(width / 2, topY + 14, "99", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "52px",
        color: "#ffd60a",
        stroke: "#3a0800",
        strokeThickness: 6,
      })
      .setOrigin(0.5);
  }

  updateHUD() {
    const p1Ratio = this.fighter1.health / this.fighter1.maxHealth;
    const p2Ratio = this.fighter2.health / this.fighter2.maxHealth;

    this.p1HealthFill.width = this.barWidth * p1Ratio;
    this.p2HealthFill.width = this.barWidth * p2Ratio;

    this.p1HealthFill.setFillStyle(p1Ratio > 0.35 ? 0xffcc00 : 0xff3b30);
    this.p2HealthFill.setFillStyle(p2Ratio > 0.35 ? 0xffcc00 : 0xff3b30);

    const p1Sp =
      this.fighter1.cooldowns.special > 0
        ? `CD ${(this.fighter1.cooldowns.special / 1000).toFixed(1)}s`
        : "READY";
    const p2Sp =
      this.fighter2.cooldowns.special > 0
        ? `CD ${(this.fighter2.cooldowns.special / 1000).toFixed(1)}s`
        : "READY";

    this.p1StateBadge.setText(
      `HP: ${this.fighter1.health} | ${this.fighter1.state} | SP: ${p1Sp}`,
    );

    const aiInfo = this.aiController
      ? ` | AI:${this.aiController.difficultyName.toUpperCase()}`
      : "";
    this.p2StateBadge.setText(
      `HP: ${this.fighter2.health} | ${this.fighter2.state} | SP: ${p2Sp}${aiInfo}`,
    );

    const dist = Math.round(Math.abs(this.fighter2.x - this.fighter1.x));
    const aiTacticLabel = this.aiController
      ? ` | AI TACTIC: ${this.aiController.currentTactic}`
      : "";

    this.movementDebugText.setText(
      `RAMA X: ${Math.round(this.fighter1.x)}  ||  JUN X: ${Math.round(this.fighter2.x)}  ||  DIST: ${dist}px${aiTacticLabel}`,
    );
  }

  handleCombatHit(event) {
    const {
      attacker,
      defender,
      attackSpec,
      blocked,
      damage,
      impactX,
      impactY,
    } = event;

    soundManager.playHit(attackSpec.state, blocked);
    this.effectsManager.spawnHitEffect(
      impactX,
      impactY,
      attackSpec.state,
      blocked,
      attacker.facing,
    );
    this.effectsManager.triggerImpactCameraFeedback(attackSpec.state, blocked);

    const popupLabel = blocked ? `BLOCK -${damage}` : `-${damage} HP`;
    const popupColor = blocked
      ? "#64d2ff"
      : attackSpec.state === "SPECIAL"
        ? "#ff3b30"
        : "#ffd60a";
    this.effectsManager.spawnFloatingPopup(
      defender.x,
      defender.y - 220,
      popupLabel,
      popupColor,
    );

    const actionLabel = blocked ? "BLOCKED" : `${attackSpec.state} HIT`;
    this.combatFeedText.setText(
      `${attacker.characterData.name} -> ${defender.characterData.name}: ${actionLabel} (-${damage} HP)`,
    );

    if (defender.health <= 0) {
      const winner = attacker;
      const loser = defender;
      winner.sprite.play(`${winner.characterData.id}_victory`, true);
      loser.sprite.play(`${loser.characterData.id}_defeat`, true);

      this.time.delayedCall(1100, () => {
        this.fighter1.resetFighter();
        this.fighter2.resetFighter();
        if (this.aiController) this.aiController.reset();
        this.combatFeedText.setText(
          "KO! SPARRING HEALTH RESET FOR CONTINUOUS TESTING",
        );
      });
    }
  }

  drawDebugBoxes() {
    this.debugGraphics.clear();
    if (!this.showDebugBoxes) return;

    this.debugGraphics.lineStyle(2, 0x30d158, 0.9);
    this.debugGraphics.strokeRectShape(this.fighter1.hurtbox);
    this.debugGraphics.strokeRectShape(this.fighter2.hurtbox);

    this.debugGraphics.lineStyle(3, 0xff3b30, 1);
    if (this.fighter1.isHitboxActive) {
      this.debugGraphics.strokeRectShape(this.fighter1.hitbox);
    }
    if (this.fighter2.isHitboxActive) {
      this.debugGraphics.strokeRectShape(this.fighter2.hitbox);
    }
  }

  buildBottomUtilityBar(width, height) {
    createArcadeButton(
      this,
      140,
      height - 28,
      "CHANGE FIGHTER",
      () => {
        this.scene.start("CharacterScene");
      },
      { width: 185, height: 34, accentColor: 0x8e8e93, fontSize: "13px" },
    );

    const btnDebug = createArcadeButton(
      this,
      355,
      height - 28,
      "HITBOX DEBUG: OFF",
      () => {
        this.showDebugBoxes = !this.showDebugBoxes;
        btnDebug.setLabel(
          `HITBOX DEBUG: ${this.showDebugBoxes ? "ON" : "OFF"}`,
        );
      },
      { width: 195, height: 34, accentColor: 0x0a84ff, fontSize: "13px" },
    );

    const diffs = ["Easy", "Normal", "Hard"];
    const btnDiff = createArcadeButton(
      this,
      580,
      height - 28,
      this.isPVE
        ? `AI: ${GameSession.settings.aiDifficulty.toUpperCase()}`
        : "MODE: 2P LOCAL",
      () => {
        if (!this.isPVE || !this.aiController) return;
        const idx =
          (diffs.indexOf(GameSession.settings.aiDifficulty) + 1) % diffs.length;
        const nextDiff = diffs[idx];
        saveSettings({ aiDifficulty: nextDiff });
        this.aiController.setDifficulty(nextDiff);
        btnDiff.setLabel(`AI: ${nextDiff.toUpperCase()}`);
        this.combatFeedText.setText(
          `AI DIFFICULTY CHANGED TO ${nextDiff.toUpperCase()}`,
        );
      },
      { width: 205, height: 34, accentColor: 0x30d158, fontSize: "13px" },
    );

    createArcadeButton(
      this,
      815,
      height - 28,
      "RESET HP & POS",
      () => {
        this.fighter1.resetFighter();
        this.fighter2.resetFighter();
        if (this.aiController) this.aiController.reset();
        this.combatFeedText.setText("POSITIONS & HEALTH RESET");
      },
      { width: 195, height: 34, accentColor: 0xff9f0a, fontSize: "13px" },
    );

    createArcadeButton(
      this,
      width - 140,
      height - 28,
      "MAIN MENU",
      () => {
        this.scene.start("MenuScene");
      },
      { width: 185, height: 34, accentColor: 0xff3b30, fontSize: "13px" },
    );
  }

  update(time, delta) {
    if (!this.fighter1 || !this.fighter2 || !this.inputManager) return;

    const p1Input = this.inputManager.getPlayerState(1);
    const p2Input =
      this.isPVE && this.aiController
        ? this.aiController.getInputState(delta)
        : this.inputManager.getPlayerState(2);

    this.fighter1.update(delta, p1Input);
    this.fighter2.update(delta, p2Input);

    this.combatSystem.update();
    this.updateHUD();
    this.drawDebugBoxes();
    this.inputManager.clearJustPressed();
  }
}
