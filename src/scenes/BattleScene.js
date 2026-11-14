import Phaser from "phaser";
import { MATCH_CONFIG } from "../config/gameData.js";
import Fighter from "../entities/Fighter.js";
import AIController from "../entities/AIController.js";
import InputManager from "../systems/InputManager.js";
import TouchControls from "../systems/TouchControls.js";
import CombatSystem from "../systems/CombatSystem.js";
import EffectsManager from "../systems/EffectsManager.js";
import RoundManager from "../systems/RoundManager.js";
import { networkManager } from "../systems/NetworkManager.js";
import { soundManager } from "../systems/SoundManager.js";
import {
  GameSession,
  createArcadeButton,
  shouldShowTouchControls,
  isPortraitMobile,
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
    this.isOnline = mode === "ONLINE";
    this.isPVE = mode === "PVE";
    this.onlineSlot = this.isOnline ? networkManager.playerSlot : 1;
    this.latestNetState = null;
    this.onlineFightingPhase = false;

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
    this.touchControls = new TouchControls(this);
    this.inputManager.attachTouchControls(this.touchControls);

    this.aiController = this.isPVE
      ? new AIController(
          this,
          this.fighter2,
          this.fighter1,
          settings.aiDifficulty,
        )
      : null;

    this.combatSystem = !this.isOnline
      ? new CombatSystem(this, this.fighter1, this.fighter2, (hitEvent) =>
          this.handleCombatHit(hitEvent),
        )
      : null;

    this.debugGraphics = this.add.graphics().setDepth(40);

    this.createRoundAnnouncementOverlay(width, height);
    this.createMatchResultModal(width, height);

    if (!this.isOnline) {
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
          this.combatSystem.updateFacingDirections();
          this.fighter1.syncVisuals();
          this.fighter2.syncVisuals();
          this.displayedP1Health = this.fighter1.maxHealth;
          this.displayedP2Health = this.fighter2.maxHealth;
          this.trailP1Health = this.fighter1.maxHealth;
          this.trailP2Health = this.fighter2.maxHealth;
          this.inputManager.resetBuffers();
          if (this.aiController) this.aiController.reset();
          this.roundTitleBadge.setText(`ROUND ${roundNumber} (BEST OF 5)`);
        },
        onMatchEnd: (matchSummary) => {
          this.showMatchResultModal(matchSummary);
        },
      });
    } else {
      this.roundManager = null;
      this.bindOnlineBattleEvents();
    }

    this.events.once("shutdown", () => {
      if (this.roundManager) this.roundManager.destroy();
      this.unbindOnlineBattleEvents();
    });

    const modeHeadline = this.isOnline
      ? `ONLINE ROOM [${networkManager.roomCode}] — YOU ARE P${this.onlineSlot} (${this.onlineSlot === 1 ? 'RAMA' : 'JUN'})`
      : this.isPVE
        ? `MODE: PLAYER VS AI (${settings.aiDifficulty.toUpperCase()}) — BEST OF 5 ROUNDS`
        : 'LOCAL 2-PLAYER PvP — BEST OF 5 ROUNDS (FIRST TO 3 WINS)';

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
        this.isOnline
          ? `ONLINE SYNC ACTIVE\nRoom: ${networkManager.roomCode}`
          : this.isPVE
            ? `AI CONTROLLED (${settings.aiDifficulty.toUpperCase()})\nBest of 5 Match Active`
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

    const touchActive = shouldShowTouchControls();
    this.p1ControlGuide.setVisible(!touchActive);
    this.p2ControlGuide.setVisible(!touchActive);
    this.p1StateBadge.setVisible(!touchActive);
    this.p2StateBadge.setVisible(!touchActive);

    this.input.on("pointerdown", () => {
      soundManager.ensureContext();
      if (this.game && this.game.canvas) {
        this.game.canvas.focus();
      }
    });

    this.buildBottomUtilityBar(width, height);

    if (this.roundManager) {
      this.roundManager.startMatch();
    }
  }

  bindOnlineBattleEvents() {
    const socket = networkManager.connect();

    this.onOnlineState = (statePacket) => {
      this.latestNetState = statePacket;
      this.onlineFightingPhase = statePacket.phase === "FIGHTING";
    };

    this.onOnlineBanner = (b) => {
      if (b.title === "FIGHT!") soundManager.playRoundStart();
      else if (b.title.includes("K.O.") || b.title.includes("TIME OVER"))
        soundManager.playRoundKO();
      this.updateCenterBanner(b.title, b.sub, b.color, b.visible);
    };

    this.onOnlineRoundReset = (info) => {
      this.fighter1.resetFighter();
      this.fighter2.resetFighter();
      this.combatSystem.updateFacingDirections();
      this.fighter1.syncVisuals();
      this.fighter2.syncVisuals();
      this.displayedP1Health = this.fighter1.maxHealth;
      this.displayedP2Health = this.fighter2.maxHealth;
      this.trailP1Health = this.fighter1.maxHealth;
      this.trailP2Health = this.fighter2.maxHealth;
      this.inputManager.resetBuffers();
      this.roundTitleBadge.setText(`ROUND ${info.round} (ONLINE BEST OF 5)`);
    };

    this.onOnlineHit = (ev) => {
      const attacker = ev.attackerNum === 1 ? this.fighter1 : this.fighter2;
      const defender = ev.defenderNum === 1 ? this.fighter1 : this.fighter2;

      defender.health = Math.max(0, defender.health - ev.damage);
      if ( !ev.blocked && defender.health > 0 ) {
        defender.setState('HIT', true);
      }

      soundManager.playHit(ev.attackState, ev.blocked);
      this.effectsManager.spawnHitEffect(
        ev.impactX,
        ev.impactY,
        ev.attackState,
        ev.blocked,
        attacker.facing,
      );
      this.effectsManager.triggerImpactCameraFeedback(
        ev.attackState,
        ev.blocked,
      );

      const popupLabel = ev.blocked
        ? `BLOCK -${ev.damage}`
        : `-${ev.damage} HP`;
      const popupColor = ev.blocked
        ? "#64d2ff"
        : ev.attackState === "SPECIAL"
          ? "#ff3b30"
          : "#ffd60a";
      this.effectsManager.spawnFloatingPopup(
        defender.x,
        defender.y - 220,
        popupLabel,
        popupColor,
      );

      const actionLabel = ev.blocked ? "BLOCKED" : `${ev.attackState} HIT`;
      this.combatFeedText.setText(
        `${attacker.characterData.name} -> ${defender.characterData.name}: ${actionLabel} (-${ev.damage} HP)`,
      );
    };

    this.onOnlineMatchEnd = (summary) => {
      this.onlineFightingPhase = false;
      soundManager.playMatchVictory(summary.outcome === "DRAW");
      this.showMatchResultModal(summary);
    };

    this.onOnlineRematchStatus = (info) => {
      if (this.btnRematchModal) {
        this.btnRematchModal.setLabel(
          `REMATCH (${info.votes.length}/${info.totalRequired})`,
        );
      }
    };

    this.onOnlineRematchStart = () => {
      this.resultModal.setVisible(false);
      if (this.btnRematchModal) {
        this.btnRematchModal.setLabel("REMATCH");
      }
    };

    this.onPlayerDisconnected = (info) => {
      this.onlineFightingPhase = false;
      this.updateCenterBanner(
        "OPPONENT DISCONNECTED",
        `WAITING ${info.graceSeconds}s FOR RECONNECT...`,
        "#ff9f0a",
        true,
      );
    };

    this.onPlayerReconnected = () => {
      this.updateCenterBanner("", "", "#ffffff", false);
      this.combatFeedText.setText("OPPONENT RECONNECTED — MATCH RESUMED!");
    };

    this.onOpponentLeft = (info) => {
      this.onlineFightingPhase = false;
      this.updateCenterBanner("", "", "#ffffff", false);
      const myOutcome = this.onlineSlot === 1 ? "P1" : "P2";
      this.showMatchResultModal({
        outcome: myOutcome,
        p1Wins: this.latestNetState?.p1Wins || 0,
        p2Wins: this.latestNetState?.p2Wins || 0,
        forfeitMessage: info?.message || "OPPONENT LEFT THE ROOM.",
      });
    };

    socket.on("online:state", this.onOnlineState);
    socket.on("online:banner", this.onOnlineBanner);
    socket.on("online:round_reset", this.onOnlineRoundReset);
    socket.on("online:hit", this.onOnlineHit);
    socket.on("online:match_end", this.onOnlineMatchEnd);
    socket.on("online:rematch_status", this.onOnlineRematchStatus);
    socket.on("online:rematch_start", this.onOnlineRematchStart);
    socket.on("online:player_disconnected", this.onPlayerDisconnected);
    socket.on("online:player_reconnected", this.onPlayerReconnected);
    socket.on("online:opponent_left", this.onOpponentLeft);
    networkManager.requestRoomSync();
  }

  unbindOnlineBattleEvents() {
    const socket = networkManager.socket;
    if (!socket) return;
    socket.off("online:state", this.onOnlineState);
    socket.off("online:banner", this.onOnlineBanner);
    socket.off("online:round_reset", this.onOnlineRoundReset);
    socket.off("online:hit", this.onOnlineHit);
    socket.off("online:match_end", this.onOnlineMatchEnd);
    socket.off("online:rematch_status", this.onOnlineRematchStatus);
    socket.off("online:rematch_start", this.onOnlineRematchStart);
    socket.off("online:player_disconnected", this.onPlayerDisconnected);
    socket.off("online:player_reconnected", this.onPlayerReconnected);
    socket.off("online:opponent_left", this.onOpponentLeft);
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
    this.barWidth = 445;
    this.barHeight = 24;
    const topY = 32;

    hud.fillGradientStyle(0x06060b, 0x06060b, 0x000000, 0x000000, 0.72);
    hud.fillRect(0, 0, width, 96);

    hud.fillStyle(0x1f080a, 0.96);
    hud.fillRect(68, topY, this.barWidth + 8, this.barHeight + 8);
    hud.fillRect(
      width - 76 - this.barWidth,
      topY,
      this.barWidth + 8,
      this.barHeight + 8,
    );

    this.p1DamageTrail = this.add
      .rectangle(
        72 + this.barWidth,
        topY + 4 + this.barHeight / 2,
        this.barWidth,
        this.barHeight,
        0xc91e14,
      )
      .setOrigin(1, 0.5)
      .setDepth(31);

    this.p2DamageTrail = this.add
      .rectangle(
        width - 72 - this.barWidth,
        topY + 4 + this.barHeight / 2,
        this.barWidth,
        this.barHeight,
        0xc91e14,
      )
      .setOrigin(0, 0.5)
      .setDepth(31);

    this.p1HealthFill = this.add
      .rectangle(
        72 + this.barWidth,
        topY + 4 + this.barHeight / 2,
        this.barWidth,
        this.barHeight,
        0xffcc00,
      )
      .setOrigin(1, 0.5)
      .setDepth(32);

    this.p2HealthFill = this.add
      .rectangle(
        width - 72 - this.barWidth,
        topY + 4 + this.barHeight / 2,
        this.barWidth,
        this.barHeight,
        0xffcc00,
      )
      .setOrigin(0, 0.5)
      .setDepth(32);

    const frameOverlay = this.add.graphics().setDepth(33);
    frameOverlay.lineStyle(3, 0xffd60a, 1);
    frameOverlay.strokeRect(68, topY, this.barWidth + 8, this.barHeight + 8);
    frameOverlay.strokeRect(
      width - 76 - this.barWidth,
      topY,
      this.barWidth + 8,
      this.barHeight + 8,
    );

    frameOverlay.fillStyle(p1.color, 1);
    frameOverlay.fillRect(24, topY, 38, 38);
    frameOverlay.lineStyle(2, 0xffd60a, 1);
    frameOverlay.strokeRect(24, topY, 38, 38);

    frameOverlay.fillStyle(p2.color, 1);
    frameOverlay.fillRect(width - 62, topY, 38, 38);
    frameOverlay.lineStyle(2, 0xffd60a, 1);
    frameOverlay.strokeRect(width - 62, topY, 38, 38);

    this.add
      .text(43, topY + 19, "P1", {
        fontFamily: '"Teko", Impact, sans-serif',
        fontSize: "26px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(34);

    this.add
      .text(width - 43, topY + 19, this.isPVE ? "AI" : "P2", {
        fontFamily: '"Teko", Impact, sans-serif',
        fontSize: "26px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(34);

    const p1Tag =
      this.isOnline && this.onlineSlot === 1
        ? `${p1.fullTitle} (YOU)`
        : p1.fullTitle;
    const p2Tag = this.isOnline
      ? this.onlineSlot === 2
        ? `${p2.fullTitle} (YOU)`
        : p2.fullTitle
      : this.isPVE
        ? `${p2.fullTitle} [AI]`
        : p2.fullTitle;

    this.add
      .text(70, topY + 36, p1Tag, {
        fontFamily: '"Teko", Impact, "Arial Black", sans-serif',
        fontSize: "30px",
        color: "#ffffff",
        letterSpacing: 1,
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setDepth(33);

    this.p2NameText = this.add
      .text(width - 70, topY + 36, p2Tag, {
        fontFamily: '"Teko", Impact, "Arial Black", sans-serif',
        fontSize: "30px",
        color: "#ffffff",
        letterSpacing: 1,
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(1, 0)
      .setDepth(33);

    this.p1WinOrbs = [
      this.add.circle(width / 2 - 108, topY + 48, 8, 0x262636).setStrokeStyle(2, 0xffd60a).setDepth(33),
      this.add.circle(width / 2 - 86, topY + 48, 8, 0x262636).setStrokeStyle(2, 0xffd60a).setDepth(33),
      this.add.circle(width / 2 - 64, topY + 48, 8, 0x262636).setStrokeStyle(2, 0xffd60a).setDepth(33)
    ];

    this.p2WinOrbs = [
      this.add.circle(width / 2 + 64, topY + 48, 8, 0x262636).setStrokeStyle(2, 0xffd60a).setDepth(33),
      this.add.circle(width / 2 + 86, topY + 48, 8, 0x262636).setStrokeStyle(2, 0xffd60a).setDepth(33),
      this.add.circle(width / 2 + 108, topY + 48, 8, 0x262636).setStrokeStyle(2, 0xffd60a).setDepth(33)
    ];

    this.p1StateBadge = this.add.text(70, topY + 68, 'HP: 100 | IDLE | SP: READY', {
      fontFamily: '"Rajdhani", sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#30d158',
      backgroundColor: '#000000cc',
      padding: { x: 8, y: 2 }
    }).setDepth(33);

    this.p2StateBadge = this.add.text(width - 70, topY + 68, 'HP: 100 | IDLE | SP: READY', {
      fontFamily: '"Rajdhani", sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#30d158',
      backgroundColor: '#000000cc',
      padding: { x: 8, y: 2 }
    }).setOrigin(1, 0).setDepth(33);

    this.roundTitleBadge = this.add.text(width / 2, 12, 'ROUND 1 (BEST OF 5)', {
      fontFamily: '"Rajdhani", sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffd60a',
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(33);

    frameOverlay.fillStyle(0x160a0c, 0.95);
    frameOverlay.lineStyle(3, 0xffd60a, 1);
    frameOverlay.fillCircle(width / 2, topY + 24, 34);
    frameOverlay.strokeCircle(width / 2, topY + 24, 34);

    this.timerText = this.add
      .text(width / 2, topY + 24, "99", {
        fontFamily: '"Teko", Impact, "Arial Black", sans-serif',
        fontSize: "56px",
        color: "#ffd60a",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(34);
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
        fontSize: "54px",
        color: "#ffd60a",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.bannerSubText = this.add
      .text(0, 34, "GET READY", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "20px",
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

    this.btnRematchModal = createArcadeButton(
      this,
      -145,
      138,
      "REMATCH",
      () => {
        if (this.isOnline) {
          networkManager.requestRematch();
          this.btnRematchModal.setLabel("WAITING OPPONENT...");
          return;
        }
        this.resultModal.setVisible(false);
        this.roundManager.startMatch();
      },
      { width: 240, height: 46, accentColor: 0x30d158, fontSize: "18px" },
    );

    const btnMenu = createArcadeButton(
      this,
      145,
      138,
      "MAIN MENU",
      () => {
        if (this.roundManager) this.roundManager.destroy();
        if (this.isOnline) networkManager.leaveRoom();
        this.scene.start("MenuScene");
      },
      { width: 240, height: 46, accentColor: 0xff3b30, fontSize: "18px" },
    );

    this.resultModal.add([
      dimOverlay,
      card,
      this.resultHeader,
      this.resultWinnerLine,
      this.resultLoserLine,
      this.resultScoreLine,
      this.resultSubInfo,
      this.btnRematchModal,
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
      const iWon = !this.isOnline || this.onlineSlot === 1;
      this.resultHeader.setText(iWon ? "VICTORY!" : "DEFEAT");
      this.resultHeader.setColor(iWon ? "#ffd60a" : "#ff3b30");
      this.resultWinnerLine.setText(`WINNER: ${p1Name} (PLAYER 1)`);
      this.resultWinnerLine.setColor("#30d158");
      this.resultLoserLine.setText(`LOSER: ${p2Name}`);
      this.resultLoserLine.setColor("#ff453a");
    } else if (summary.outcome === "P2") {
      const iWon = this.isOnline ? this.onlineSlot === 2 : !this.isPVE;
      this.resultHeader.setText(iWon ? "VICTORY!" : "DEFEAT");
      this.resultHeader.setColor(iWon ? "#ffd60a" : "#ff3b30");
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

    const modeInfo = summary.forfeitMessage
      ? summary.forfeitMessage
      : this.isOnline
        ? `Online Room: ${networkManager.roomCode}  •  Arena: ${GameSession.arena.name}`
        : this.isPVE
          ? `Mode: Player vs AI (${GameSession.settings.aiDifficulty})  •  Arena: ${GameSession.arena.name}`
          : `Mode: Local 2-Player PvP  •  Arena: ${GameSession.arena.name}`;
    this.resultSubInfo.setText(modeInfo);

    if (this.btnRematchModal) {
      this.btnRematchModal.setLabel("REMATCH");
    }

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
    const trailSpeed = Math.min(1, safeDelta * 0.008);

    const targetP1 = Phaser.Math.Clamp(this.fighter1.health, 0, this.fighter1.maxHealth);
    const targetP2 = Phaser.Math.Clamp(this.fighter2.health, 0, this.fighter2.maxHealth);

    this.displayedP1Health = targetP1;
    this.displayedP2Health = targetP2;

    this.trailP1Health = Phaser.Math.Linear(this.trailP1Health, targetP1, trailSpeed);
    this.trailP2Health = Phaser.Math.Linear(this.trailP2Health, targetP2, trailSpeed);

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

    const secondsLeft = this.isOnline
      ? this.latestNetState
        ? this.latestNetState.timer
        : 99
      : this.roundManager
        ? this.roundManager.getDisplaySeconds()
        : 99;
    this.timerText.setText(String(secondsLeft).padStart(2, "0"));
    this.timerText.setColor(secondsLeft <= 15 ? "#ff3b30" : "#ffd60a");

    const p1WinsCount = this.isOnline
      ? this.latestNetState?.p1Wins || 0
      : this.roundManager?.p1Wins || 0;
    const p2WinsCount = this.isOnline
      ? this.latestNetState?.p2Wins || 0
      : this.roundManager?.p2Wins || 0;

    this.p1WinOrbs.forEach((orb, idx) => {
      orb.setFillStyle(idx < p1WinsCount ? 0xff3b30 : 0x262636);
    });
    this.p2WinOrbs.forEach((orb, idx) => {
      orb.setFillStyle(idx < p2WinsCount ? 0x0a84ff : 0x262636);
    });

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
    this.p2StateBadge.setText(
      `HP: ${targetP2} | ${this.fighter2.state} | SP: ${p2Sp}`,
    );
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
    if (this.isOnline) return;
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
      this.combatFeedText.setText(
        `MODE: PLAYER VS AI (${settings.aiDifficulty.toUpperCase()}) — BEST OF 5 ROUNDS`,
      );
    } else {
      this.aiController = null;
      this.p2NameText.setText(`${p2Character.name} (P2)`);
      this.combatFeedText.setText(
        "LOCAL 2-PLAYER PvP — BEST OF 5 ROUNDS (FIRST TO 3 WINS)",
      );
    }

    this.resultModal.setVisible(false);
    this.roundManager.startMatch();
  }

  buildBottomUtilityBar(width, height) {
    const centerY = height - 24;

    if (this.isOnline) {
      const btnDebug = createArcadeButton(
        this,
        width / 2 - 110,
        centerY,
        "HITBOX: OFF",
        () => {
          this.showDebugBoxes = !this.showDebugBoxes;
          this.movementDebugText.setVisible(this.showDebugBoxes);
          btnDebug.setLabel(`HITBOX: ${this.showDebugBoxes ? "ON" : "OFF"}`);
        },
        { width: 145, height: 30, accentColor: 0x0a84ff, fontSize: "12px" },
      ).setDepth(45);

      createArcadeButton(
        this,
        width / 2 + 110,
        centerY,
        "LEAVE ONLINE",
        () => {
          networkManager.leaveRoom();
          this.scene.start("MenuScene");
        },
        { width: 165, height: 30, accentColor: 0xff3b30, fontSize: "12px" },
      ).setDepth(45);
      return;
    }

    createArcadeButton(
      this,
      width / 2 - 270,
      centerY,
      "FIGHTERS",
      () => {
        if (this.roundManager) this.roundManager.destroy();
        this.scene.start("CharacterScene");
      },
      { width: 125, height: 30, accentColor: 0x8e8e93, fontSize: "12px" },
    ).setDepth(45);

    const btnDebug = createArcadeButton(
      this,
      width / 2 - 135,
      centerY,
      "HITBOX: OFF",
      () => {
        this.showDebugBoxes = !this.showDebugBoxes;
        this.movementDebugText.setVisible(this.showDebugBoxes);
        btnDebug.setLabel(`HITBOX: ${this.showDebugBoxes ? "ON" : "OFF"}`);
      },
      { width: 125, height: 30, accentColor: 0x0a84ff, fontSize: "12px" },
    ).setDepth(45);

    const btnMode = createArcadeButton(
      this,
      width / 2,
      centerY,
      this.isPVE ? "MODE: PvAI" : "MODE: 2P PvP",
      () => {
        this.toggleGameMode();
        btnMode.setLabel(this.isPVE ? "MODE: PvAI" : "MODE: 2P PvP");
      },
      { width: 130, height: 30, accentColor: 0x30d158, fontSize: "12px" },
    ).setDepth(45);

    createArcadeButton(
      this,
      width / 2 + 135,
      centerY,
      "RESTART",
      () => {
        this.resultModal.setVisible(false);
        this.roundManager.startMatch();
        this.combatFeedText.setText("MATCH RESTARTED — ROUND 1");
      },
      { width: 125, height: 30, accentColor: 0xff9f0a, fontSize: "12px" },
    ).setDepth(45);

    createArcadeButton(
      this,
      width / 2 + 270,
      centerY,
      "MENU",
      () => {
        if (this.roundManager) this.roundManager.destroy();
        this.scene.start("MenuScene");
      },
      { width: 125, height: 30, accentColor: 0xff3b30, fontSize: "12px" },
    ).setDepth(45);
  }

  getCombinedLocalOnlineInput(delta) {
    const p1 = this.inputManager.getPlayerState(1, delta);
    const p2 = this.inputManager.getPlayerState(2, delta);
    return {
      left: p1.left || p2.left,
      right: p1.right || p2.right,
      up: p1.up || p2.up,
      down: p1.down || p2.down,
      blockHeld: p1.blockHeld || p2.blockHeld,
      jumpPressed: p1.jumpPressed || p2.jumpPressed,
      punchPressed: p1.punchPressed || p2.punchPressed,
      kickPressed: p1.kickPressed || p2.kickPressed,
      specialPressed: p1.specialPressed || p2.specialPressed,
      consumeAction: (act) => {
        p1.consumeAction(act);
        p2.consumeAction(act);
      },
    };
  }

  update(time, delta) {
    if (!this.fighter1 || !this.fighter2 || !this.inputManager) return;

    if (isPortraitMobile()) {
      if (this.touchControls) this.touchControls.releaseAll();
      return;
    }

    if (this.isOnline) {
      const canAct = this.onlineFightingPhase;
      const myFighter = this.onlineSlot === 1 ? this.fighter1 : this.fighter2;
      if (this.touchControls) {
        this.touchControls.setEnabled(canAct);
        this.touchControls.updateSpecialStatus(myFighter.cooldowns.special);
      }

      if (canAct) {
        const localInput = this.getCombinedLocalOnlineInput(delta);
        networkManager.sendInput(localInput);
      }

      if (this.latestNetState) {
        this.fighter1.applyAuthoritativeNetState(this.latestNetState.f1, delta);
        this.fighter2.applyAuthoritativeNetState(this.latestNetState.f2, delta);
      }

      this.updateHUD(delta);
      this.drawDebugBoxes();
      this.inputManager.clearJustPressed();
      return;
    }

    if (!this.roundManager) return;
    this.roundManager.update(delta);

    const canControlFighters = this.roundManager.isFighting();
    if (this.touchControls) {
      this.touchControls.setEnabled(canControlFighters);
      this.touchControls.updateSpecialStatus(this.fighter1.cooldowns.special);
    }

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
    } else if (this.roundManager.phase === 'INTRO') {
      this.combatSystem.updateFacingDirections();
      this.fighter1.syncVisuals();
      this.fighter2.syncVisuals();
    }

    this.updateHUD(delta);
    this.drawDebugBoxes();
    this.inputManager.clearJustPressed();
  }
}
