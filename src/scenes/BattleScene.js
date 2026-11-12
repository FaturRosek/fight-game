import Phaser from "phaser";
import { MATCH_CONFIG } from "../config/gameData.js";
import Fighter from "../entities/Fighter.js";
import AIController from "../entities/AIController.js";
import InputManager from "../systems/InputManager.js";
import CombatSystem from "../systems/CombatSystem.js";
import EffectsManager from "../systems/EffectsManager.js";
import RoundManager from "../systems/RoundManager.js";
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

    this.displayedP1Health = 100;
    this.displayedP2Health = 100;
    this.trailP1Health = 100;
    this.trailP2Health = 100;

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

    this.debugGraphics = this.add.graphics().setDepth(40);

    this.createRoundAnnouncementOverlay(width, height);
    this.createMatchResultModal(width, height);

    const configuredRoundsToWin =
      settings.roundsToWin || MATCH_CONFIG.roundsToWin;
    this.roundManager = new RoundManager(this, {
      fighter1: this.fighter1,
      fighter2: this.fighter2,
      roundsToWin: configuredRoundsToWin,
      roundDurationSeconds: MATCH_CONFIG.roundDurationSeconds,
      onBannerUpdate: (title, sub, color, visible) => {
        this.updateCenterBanner(title, sub, color, visible);
      },
      onRoundReset: (roundNumber) => {
        this.displayedP1Health = this.fighter1.maxHealth;
        this.displayedP2Health = this.fighter2.maxHealth;
        this.trailP1Health = this.fighter1.maxHealth;
        this.trailP2Health = this.fighter2.maxHealth;
        this.inputManager.resetBuffers();
        if (this.aiController) this.aiController.reset();
        this.roundTitleBadge.setText(`ROUND ${roundNumber} (BEST OF 3)`);
      },
      onMatchEnd: (matchSummary) => {
        this.showMatchResultModal(matchSummary);
      },
    });

    this.events.once("shutdown", () => {
      if (this.roundManager) this.roundManager.destroy();
    });

    const modeHeadline = this.isPVE
      ? `MODE: PLAYER VS AI (${settings.aiDifficulty.toUpperCase()}) — BEST OF 3 ROUNDS`
      : "LOCAL 2-PLAYER PvP — BEST OF 3 ROUNDS (FIRST TO 2 WINS)";

    this.combatFeedText = this.add
      .text(width / 2, 108, modeHeadline, {
        fontSize: "13px",
        fontStyle: "bold",
        color: "#ffd60a",
        backgroundColor: "#000000cc",
        padding: { x: 12, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(32);

    this.p1ControlGuide = this.add
      .text(
        62,
        104,
        "P1: [W]Jump [A/D]Move [S]Crouch\nATK: [F]Punch [G]Kick [H]Spec [R]Block",
        {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#e5e5ea",
          backgroundColor: "#14080acc",
          padding: { x: 8, y: 4 },
        },
      )
      .setDepth(32);

    this.p2ControlGuide = this.add
      .text(
        width - 62,
        104,
        this.isPVE
          ? `AI CONTROLLED (${settings.aiDifficulty.toUpperCase()})\nBest of 3 Match Active`
          : "P2: [UP]Jump [L/R]Move [DN]Crouch\nATK: [J]Punch [K]Kick [L]Spec [I]Block",
        {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#e5e5ea",
          backgroundColor: "#08101ecc",
          padding: { x: 8, y: 4 },
          align: "right",
        },
      )
      .setOrigin(1, 0)
      .setDepth(32);

    this.movementDebugText = this.add
      .text(width / 2, 136, "ROUND 1 READY", {
        fontFamily: "monospace",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#30d158",
        backgroundColor: "#0a0a14dd",
        padding: { x: 12, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(32)
      .setVisible(this.showDebugBoxes);

    this.input.on("pointerdown", () => {
      soundManager.ensureContext();
      if (this.game && this.game.canvas) {
        this.game.canvas.focus();
      }
    });

    this.buildBottomUtilityBar(width, height);
    this.roundManager.startMatch();
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
    const hud = this.add.graphics().setDepth(30);
    this.barWidth = 454;
    this.barHeight = 22;
    const topY = 34;

    hud.fillStyle(0x1a0808, 0.94);
    hud.fillRect(60, topY, this.barWidth + 6, this.barHeight + 6);
    hud.fillRect(
      width - 66 - this.barWidth,
      topY,
      this.barWidth + 6,
      this.barHeight + 6,
    );

    this.p1DamageTrail = this.add
      .rectangle(
        63 + this.barWidth,
        topY + 3 + this.barHeight / 2,
        this.barWidth,
        this.barHeight,
        0xb81d13,
      )
      .setOrigin(1, 0.5)
      .setDepth(31);

    this.p2DamageTrail = this.add
      .rectangle(
        width - 63 - this.barWidth,
        topY + 3 + this.barHeight / 2,
        this.barWidth,
        this.barHeight,
        0xb81d13,
      )
      .setOrigin(0, 0.5)
      .setDepth(31);

    this.p1HealthFill = this.add
      .rectangle(
        63 + this.barWidth,
        topY + 3 + this.barHeight / 2,
        this.barWidth,
        this.barHeight,
        0xffcc00,
      )
      .setOrigin(1, 0.5)
      .setDepth(32);

    this.p2HealthFill = this.add
      .rectangle(
        width - 63 - this.barWidth,
        topY + 3 + this.barHeight / 2,
        this.barWidth,
        this.barHeight,
        0xffcc00,
      )
      .setOrigin(0, 0.5)
      .setDepth(32);

    const frameOverlay = this.add.graphics().setDepth(33);
    frameOverlay.lineStyle(3, 0xffd60a, 1);
    frameOverlay.strokeRect(60, topY, this.barWidth + 6, this.barHeight + 6);
    frameOverlay.strokeRect(
      width - 66 - this.barWidth,
      topY,
      this.barWidth + 6,
      this.barHeight + 6,
    );

    this.add
      .text(62, topY + 34, `${p1.name} (P1)`, {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "26px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setDepth(33);

    this.p2NameText = this.add
      .text(
        width - 62,
        topY + 34,
        this.isPVE ? `${p2.name} (AI)` : `${p2.name} (P2)`,
        {
          fontFamily: 'Impact, "Arial Black", sans-serif',
          fontSize: "26px",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 5,
        },
      )
      .setOrigin(1, 0)
      .setDepth(33);

    this.p1WinOrbs = [
      this.add
        .circle(width / 2 - 88, topY + 46, 9, 0x262636)
        .setStrokeStyle(2, 0xffd60a)
        .setDepth(33),
      this.add
        .circle(width / 2 - 64, topY + 46, 9, 0x262636)
        .setStrokeStyle(2, 0xffd60a)
        .setDepth(33),
    ];

    this.p2WinOrbs = [
      this.add
        .circle(width / 2 + 64, topY + 46, 9, 0x262636)
        .setStrokeStyle(2, 0xffd60a)
        .setDepth(33),
      this.add
        .circle(width / 2 + 88, topY + 46, 9, 0x262636)
        .setStrokeStyle(2, 0xffd60a)
        .setDepth(33),
    ];

    this.p1StateBadge = this.add
      .text(215, topY + 40, "HP: 100 | IDLE | SP: READY", {
        fontSize: "12px",
        fontStyle: "bold",
        color: "#30d158",
        backgroundColor: "#000000aa",
        padding: { x: 8, y: 3 },
      })
      .setDepth(33);

    this.p2StateBadge = this.add
      .text(width - 215, topY + 40, "HP: 100 | IDLE | SP: READY", {
        fontSize: "12px",
        fontStyle: "bold",
        color: "#30d158",
        backgroundColor: "#000000aa",
        padding: { x: 8, y: 3 },
      })
      .setOrigin(1, 0)
      .setDepth(33);

    this.roundTitleBadge = this.add
      .text(width / 2, 14, "ROUND 1 (BEST OF 3)", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "16px",
        color: "#ffd60a",
        letterSpacing: 1.5,
      })
      .setOrigin(0.5)
      .setDepth(33);

    this.timerText = this.add
      .text(width / 2, topY + 20, "99", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "52px",
        color: "#ffd60a",
        stroke: "#3a0800",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(33);
  }

  createRoundAnnouncementOverlay(width, height) {
    this.bannerContainer = this.add
      .container(width / 2, height * 0.42)
      .setDepth(60);

    const backing = this.add.graphics();
    backing.fillStyle(0x06060c, 0.85);
    backing.lineStyle(3, 0xffd60a, 1);
    backing.fillRect(-340, -64, 680, 128);
    backing.strokeRect(-340, -64, 680, 128);

    this.bannerMainText = this.add
      .text(0, -14, "ROUND 1", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "58px",
        color: "#ffd60a",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.bannerSubText = this.add
      .text(0, 34, "GET READY", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "22px",
        color: "#ffffff",
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    this.bannerContainer.add([
      backing,
      this.bannerMainText,
      this.bannerSubText,
    ]);
    this.bannerContainer.setVisible(false);
  }

  updateCenterBanner(title, subtitle, colorHex, visible) {
    if (!visible) {
      this.bannerContainer.setVisible(false);
      return;
    }

    this.bannerMainText.setText(title);
    this.bannerMainText.setColor(colorHex || "#ffd60a");
    this.bannerSubText.setText(subtitle || "");
    this.bannerContainer.setVisible(true);
    this.bannerContainer.setScale(0.78);

    this.tweens.killTweensOf(this.bannerContainer);
    this.tweens.add({
      targets: this.bannerContainer,
      scaleX: 1,
      scaleY: 1,
      duration: 180,
      ease: "Back.easeOut",
    });
  }

  createMatchResultModal(width, height) {
    this.resultModal = this.add.container(width / 2, height / 2).setDepth(80);

    const dimOverlay = this.add
      .rectangle(0, 0, width, height, 0x000000, 0.72)
      .setInteractive();

    const cardW = 640;
    const cardH = 390;
    const card = this.add.graphics();
    card.fillStyle(0x12121d, 0.97);
    card.lineStyle(4, 0xffd60a, 1);
    card.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
    card.strokeRect(-cardW / 2, -cardH / 2, cardW, cardH);

    card.fillStyle(0xff3b30, 1);
    card.fillRect(-cardW / 2, -cardH / 2, cardW, 10);

    this.resultHeader = this.add
      .text(0, -142, "MATCH COMPLETE", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "46px",
        color: "#ffd60a",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    this.resultWinnerLine = this.add
      .text(0, -76, "WINNER: RAMA", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "32px",
        color: "#30d158",
      })
      .setOrigin(0.5);

    this.resultLoserLine = this.add
      .text(0, -34, "LOSER: JUN", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "22px",
        color: "#ff453a",
      })
      .setOrigin(0.5);

    this.resultScoreLine = this.add
      .text(0, 22, "FINAL SCORE: RAMA 2  —  0 JUN", {
        fontFamily: "monospace",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#ffffff",
        backgroundColor: "#222234",
        padding: { x: 18, y: 8 },
      })
      .setOrigin(0.5);

    this.resultSubInfo = this.add
      .text(0, 74, "", {
        fontSize: "14px",
        color: "#b0b0ba",
      })
      .setOrigin(0.5);

    const btnRematch = createArcadeButton(
      this,
      -145,
      138,
      "REMATCH",
      () => {
        this.resultModal.setVisible(false);
        this.roundManager.startMatch();
      },
      { width: 240, height: 46, accentColor: 0x30d158, fontSize: "20px" },
    );

    const btnMenu = createArcadeButton(
      this,
      145,
      138,
      "MAIN MENU",
      () => {
        this.roundManager.destroy();
        this.scene.start("MenuScene");
      },
      { width: 240, height: 46, accentColor: 0xff3b30, fontSize: "20px" },
    );

    this.resultModal.add([
      dimOverlay,
      card,
      this.resultHeader,
      this.resultWinnerLine,
      this.resultLoserLine,
      this.resultScoreLine,
      this.resultSubInfo,
      btnRematch,
      btnMenu,
    ]);

    this.resultModal.setVisible(false);
  }

  showMatchResultModal(summary) {
    const p1Name = this.fighter1.characterData.name;
    const p2Name = this.isPVE
      ? `${this.fighter2.characterData.name} (AI)`
      : this.fighter2.characterData.name;

    if (summary.outcome === "P1") {
      this.resultHeader.setText("VICTORY!");
      this.resultHeader.setColor("#ffd60a");
      this.resultWinnerLine.setText(`WINNER: ${p1Name} (PLAYER 1)`);
      this.resultWinnerLine.setColor("#30d158");
      this.resultLoserLine.setText(`LOSER: ${p2Name}`);
      this.resultLoserLine.setColor("#ff453a");
    } else if (summary.outcome === "P2") {
      this.resultHeader.setText(this.isPVE ? "DEFEAT" : "PLAYER 2 VICTORY!");
      this.resultHeader.setColor(this.isPVE ? "#ff3b30" : "#ffd60a");
      this.resultWinnerLine.setText(`WINNER: ${p2Name}`);
      this.resultWinnerLine.setColor("#30d158");
      this.resultLoserLine.setText(`LOSER: ${p1Name} (PLAYER 1)`);
      this.resultLoserLine.setColor("#ff453a");
    } else {
      this.resultHeader.setText("DRAW MATCH");
      this.resultHeader.setColor("#ffd60a");
      this.resultWinnerLine.setText("RESULT: DRAW (TIED SCORE)");
      this.resultWinnerLine.setColor("#ffd60a");
      this.resultLoserLine.setText("BOTH FIGHTERS STAND EQUAL");
      this.resultLoserLine.setColor("#c8c8d2");
    }

    this.resultScoreLine.setText(
      `FINAL ROUND SCORE:  ${p1Name} [${summary.p1Wins}]   —   [${summary.p2Wins}] ${p2Name}`,
    );

    const modeInfo = this.isPVE
      ? `Mode: Player vs AI (${GameSession.settings.aiDifficulty})  •  Arena: ${GameSession.arena.name}`
      : `Mode: Local 2-Player PvP  •  Arena: ${GameSession.arena.name}`;
    this.resultSubInfo.setText(modeInfo);

    this.resultModal.setVisible(true);
    this.resultModal.setScale(0.88);
    this.tweens.add({
      targets: this.resultModal,
      scaleX: 1,
      scaleY: 1,
      duration: 220,
      ease: "Back.easeOut",
    });
  }

  updateHUD(deltaMs) {
    const safeDelta = deltaMs > 0 ? Math.min(deltaMs, 50) : 16.67;
    const lerpSpeed = Math.min(1, safeDelta * 0.018);
    const trailSpeed = Math.min(1, safeDelta * 0.006);

    const targetP1 = Phaser.Math.Clamp(
      this.fighter1.health,
      0,
      this.fighter1.maxHealth,
    );
    const targetP2 = Phaser.Math.Clamp(
      this.fighter2.health,
      0,
      this.fighter2.maxHealth,
    );

    this.displayedP1Health = Phaser.Math.Linear(
      this.displayedP1Health,
      targetP1,
      lerpSpeed,
    );
    this.displayedP2Health = Phaser.Math.Linear(
      this.displayedP2Health,
      targetP2,
      lerpSpeed,
    );

    if (Math.abs(this.displayedP1Health - targetP1) < 0.25)
      this.displayedP1Health = targetP1;
    if (Math.abs(this.displayedP2Health - targetP2) < 0.25)
      this.displayedP2Health = targetP2;

    this.trailP1Health = Phaser.Math.Linear(
      this.trailP1Health,
      targetP1,
      trailSpeed,
    );
    this.trailP2Health = Phaser.Math.Linear(
      this.trailP2Health,
      targetP2,
      trailSpeed,
    );

    const p1Ratio = this.displayedP1Health / this.fighter1.maxHealth;
    const p2Ratio = this.displayedP2Health / this.fighter2.maxHealth;

    this.p1HealthFill.width = this.barWidth * p1Ratio;
    this.p2HealthFill.width = this.barWidth * p2Ratio;

    this.p1DamageTrail.width =
      this.barWidth * (this.trailP1Health / this.fighter1.maxHealth);
    this.p2DamageTrail.width =
      this.barWidth * (this.trailP2Health / this.fighter2.maxHealth);

    this.p1HealthFill.setFillStyle(p1Ratio > 0.35 ? 0xffcc00 : 0xff3b30);
    this.p2HealthFill.setFillStyle(p2Ratio > 0.35 ? 0xffcc00 : 0xff3b30);

    const secondsLeft = this.roundManager
      ? this.roundManager.getDisplaySeconds()
      : 99;
    this.timerText.setText(String(secondsLeft).padStart(2, "0"));
    this.timerText.setColor(secondsLeft <= 15 ? "#ff3b30" : "#ffd60a");

    if (this.roundManager) {
      this.p1WinOrbs.forEach((orb, idx) => {
        orb.setFillStyle(idx < this.roundManager.p1Wins ? 0xff3b30 : 0x262636);
      });
      this.p2WinOrbs.forEach((orb, idx) => {
        orb.setFillStyle(idx < this.roundManager.p2Wins ? 0x0a84ff : 0x262636);
      });
    }

    const p1Sp =
      this.fighter1.cooldowns.special > 0
        ? `CD ${(this.fighter1.cooldowns.special / 1000).toFixed(1)}s`
        : "READY";
    const p2Sp =
      this.fighter2.cooldowns.special > 0
        ? `CD ${(this.fighter2.cooldowns.special / 1000).toFixed(1)}s`
        : "READY";

    this.p1StateBadge.setText(
      `HP: ${targetP1} | ${this.fighter1.state} | SP: ${p1Sp}`,
    );

    const modeTag =
      this.isPVE && this.aiController
        ? ` | AI:${this.aiController.difficultyName.toUpperCase()}`
        : " | 2P";
    this.p2StateBadge.setText(
      `HP: ${targetP2} | ${this.fighter2.state} | SP: ${p2Sp}${modeTag}`,
    );

    if (this.roundManager) {
      this.movementDebugText.setText(
        `ROUND ${this.roundManager.currentRound} (${this.roundManager.phase})  ||  SCORE: ${this.fighter1.characterData.name} ${this.roundManager.p1Wins} - ${this.roundManager.p2Wins} ${this.fighter2.characterData.name}`,
      );
    }
  }

  handleCombatHit(event) {
    if (!this.roundManager || !this.roundManager.isFighting()) return;

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

  toggleGameMode() {
    const { p2Character, settings } = GameSession;
    GameSession.mode = this.isPVE ? "PVP" : "PVE";
    this.isPVE = GameSession.mode === "PVE";

    if (this.isPVE) {
      this.aiController = new AIController(
        this,
        this.fighter2,
        this.fighter1,
        settings.aiDifficulty,
      );
      this.p2NameText.setText(`${p2Character.name} (AI)`);
      this.p2ControlGuide.setText(
        `AI CONTROLLED (${settings.aiDifficulty.toUpperCase()})\nBest of 3 Match Active`,
      );
      this.combatFeedText.setText(
        `MODE: PLAYER VS AI (${settings.aiDifficulty.toUpperCase()}) — BEST OF 3 ROUNDS`,
      );
    } else {
      this.aiController = null;
      this.p2NameText.setText(`${p2Character.name} (P2)`);
      this.p2ControlGuide.setText(
        "P2: [UP]Jump [L/R]Move [DN]Crouch\nATK: [J]Punch [K]Kick [L]Spec [I]Block",
      );
      this.combatFeedText.setText(
        "LOCAL 2-PLAYER PvP — BEST OF 3 ROUNDS (FIRST TO 2 WINS)",
      );
    }

    this.resultModal.setVisible(false);
    this.roundManager.startMatch();
  }

  buildBottomUtilityBar(width, height) {
    createArcadeButton(
      this,
      125,
      height - 28,
      "CHANGE FIGHTER",
      () => {
        this.roundManager.destroy();
        this.scene.start("CharacterScene");
      },
      { width: 175, height: 34, accentColor: 0x8e8e93, fontSize: "13px" },
    ).setDepth(45);

    const btnDebug = createArcadeButton(
      this,
      315,
      height - 28,
      "HITBOX DEBUG: OFF",
      () => {
        this.showDebugBoxes = !this.showDebugBoxes;
        this.movementDebugText.setVisible(this.showDebugBoxes);
        btnDebug.setLabel(
          `HITBOX DEBUG: ${this.showDebugBoxes ? "ON" : "OFF"}`,
        );
      },
      { width: 180, height: 34, accentColor: 0x0a84ff, fontSize: "13px" },
    ).setDepth(45);

    const btnMode = createArcadeButton(
      this,
      515,
      height - 28,
      this.isPVE ? "MODE: PvAI (CLICK->PvP)" : "MODE: 2P PvP (CLICK->AI)",
      () => {
        this.toggleGameMode();
        btnMode.setLabel(
          this.isPVE ? "MODE: PvAI (CLICK->PvP)" : "MODE: 2P PvP (CLICK->AI)",
        );
        btnDiff.setLabel(
          this.isPVE
            ? `AI: ${GameSession.settings.aiDifficulty.toUpperCase()}`
            : "P2: KEYBOARD READY",
        );
      },
      { width: 200, height: 34, accentColor: 0x30d158, fontSize: "12px" },
    ).setDepth(45);

    const diffs = ["Easy", "Normal", "Hard"];
    const btnDiff = createArcadeButton(
      this,
      725,
      height - 28,
      this.isPVE
        ? `AI: ${GameSession.settings.aiDifficulty.toUpperCase()}`
        : "P2: KEYBOARD READY",
      () => {
        if (!this.isPVE || !this.aiController) return;
        const idx =
          (diffs.indexOf(GameSession.settings.aiDifficulty) + 1) % diffs.length;
        const nextDiff = diffs[idx];
        saveSettings({ aiDifficulty: nextDiff });
        this.aiController.setDifficulty(nextDiff);
        btnDiff.setLabel(`AI: ${nextDiff.toUpperCase()}`);
        this.p2ControlGuide.setText(
          `AI CONTROLLED (${nextDiff.toUpperCase()})\nBest of 3 Match Active`,
        );
      },
      { width: 190, height: 34, accentColor: 0xff9f0a, fontSize: "12px" },
    ).setDepth(45);

    createArcadeButton(
      this,
      930,
      height - 28,
      "RESTART MATCH",
      () => {
        this.resultModal.setVisible(false);
        this.roundManager.startMatch();
        this.combatFeedText.setText("MATCH RESTARTED — ROUND 1");
      },
      { width: 180, height: 34, accentColor: 0xff9f0a, fontSize: "13px" },
    ).setDepth(45);

    createArcadeButton(
      this,
      width - 125,
      height - 28,
      "MAIN MENU",
      () => {
        this.roundManager.destroy();
        this.scene.start("MenuScene");
      },
      { width: 175, height: 34, accentColor: 0xff3b30, fontSize: "13px" },
    ).setDepth(45);
  }

  update(time, delta) {
    if (
      !this.fighter1 ||
      !this.fighter2 ||
      !this.inputManager ||
      !this.roundManager
    )
      return;

    this.roundManager.update(delta);

    const canControlFighters = this.roundManager.isFighting();

    const p1Input = canControlFighters
      ? this.inputManager.getPlayerState(1, delta)
      : null;

    const p2Input = canControlFighters
      ? this.isPVE && this.aiController
        ? this.aiController.getInputState(delta)
        : this.inputManager.getPlayerState(2, delta)
      : null;

    this.fighter1.update(delta, p1Input);
    this.fighter2.update(delta, p2Input);

    if (canControlFighters) {
      this.combatSystem.update();
    }

    this.updateHUD(delta);
    ffgggff;
    this.drawDebugBoxes();
    this.inputManager.clearJustPressed();
    ddd;
  }
}
