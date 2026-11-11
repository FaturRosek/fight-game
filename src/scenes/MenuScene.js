import Phaser from "phaser";
import { CONTROLS_INFO } from "../config/gameData.js";
import {
  GameSession,
  saveSettings,
  drawArcadeBackground,
  createArcadeButton,
} from "../utils/helpers.js";

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create() {
    const { width, height } = this.scale;
    drawArcadeBackground(this, 0xff3b30);

    this.add.text(32, 22, "FACE FIGHTER // ARCADE EDITION v1.0", {
      fontSize: "15px",
      fontStyle: "bold",
      color: "#ff3b30",
    });

    this.modeBadge = this.add
      .text(width - 32, 22, `CURRENT MODE: ${GameSession.mode}`, {
        fontSize: "15px",
        fontStyle: "bold",
        color: "#ffd60a",
      })
      .setOrigin(1, 0);

    this.add
      .text(
        width / 2,
        height - 24,
        "USE MOUSE TO NAVIGATE MENU  •  DESKTOP BROWSER BUILD",
        {
          fontSize: "13px",
          color: "#8e8e98",
        },
      )
      .setOrigin(0.5);

    this.panelContainer = this.add.container(0, 0);
    this.showMainPanel();
  }

  clearPanel() {
    this.panelContainer.removeAll(true);
  }

  showMainPanel() {
    this.clearPanel();
    const { width, height } = this.scale;

    const emblem = this.add.graphics();
    emblem.lineStyle(3, 0xff3b30, 0.35);
    emblem.strokeCircle(width * 0.68, height * 0.52, 185);
    emblem.lineStyle(1, 0xffd60a, 0.25);
    emblem.strokeCircle(width * 0.68, height * 0.52, 215);

    const promoTitle = this.add
      .text(width * 0.68, height * 0.45, "FACE YOUR RIVAL", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "44px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const promoSub = this.add
      .text(
        width * 0.68,
        height * 0.53,
        "2D SIDE-VIEW ARCADE COMBAT\nPLAYER VS AI  •  LOCAL 2-PLAYER",
        {
          fontSize: "16px",
          color: "#b0b0ba",
          align: "center",
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5);

    const titleShadow = this.add.text(94, 124, "FACE FIGHTER", {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: "82px",
      color: "#3a0808",
    });

    const titleMain = this.add.text(90, 120, "FACE FIGHTER", {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: "82px",
      color: "#ff3b30",
      stroke: "#ffd60a",
      strokeThickness: 2,
    });

    const tagline = this.add.text(94, 210, "CUSTOM FACE COMBAT ARENA", {
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffd60a",
      letterSpacing: 4,
    });

    const startX = 235;
    const startY = 310;
    const gap = 68;

    const btnPlay = createArcadeButton(
      this,
      startX,
      startY,
      "PLAY GAME",
      () => {
        this.showModeSelectPanel();
      },
      { width: 290, height: 52, accentColor: 0xff3b30 },
    );

    const btnControls = createArcadeButton(
      this,
      startX,
      startY + gap,
      "CONTROLS",
      () => {
        this.showControlsPanel();
      },
      { width: 290, height: 50, accentColor: 0xff9f0a },
    );

    const btnSettings = createArcadeButton(
      this,
      startX,
      startY + gap * 2,
      "SETTINGS",
      () => {
        this.showSettingsPanel();
      },
      { width: 290, height: 50, accentColor: 0xff9f0a },
    );

    const btnCredits = createArcadeButton(
      this,
      startX,
      startY + gap * 3,
      "CREDITS",
      () => {
        this.showCreditsPanel();
      },
      { width: 290, height: 50, accentColor: 0x8e8e93 },
    );

    this.panelContainer.add([
      emblem,
      promoTitle,
      promoSub,
      titleShadow,
      titleMain,
      tagline,
      btnPlay,
      btnControls,
      btnSettings,
      btnCredits,
    ]);
  }

  showModeSelectPanel() {
    this.clearPanel();
    const { width, height } = this.scale;

    const header = this.add
      .text(width / 2, 130, "SELECT COMBAT MODE", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "52px",
        color: "#ffffff",
        stroke: "#ff3b30",
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    const sub = this.add
      .text(width / 2, 182, "Choose how you want to enter the arena", {
        fontSize: "18px",
        color: "#b0b0ba",
      })
      .setOrigin(0.5);

    const pveCard = this.createModeCard(
      width / 2 - 230,
      height / 2 + 10,
      "PLAYER VS AI",
      "SINGLE PLAYER ARCADE",
      "Fight against a computer-controlled opponent with adjustable difficulty.",
      0xff3b30,
      () => {
        GameSession.mode = "PVE";
        this.modeBadge.setText("CURRENT MODE: PVE");
        this.scene.start("CharacterScene");
      },
    );

    const pvpCard = this.createModeCard(
      width / 2 + 230,
      height / 2 + 10,
      "PLAYER VS PLAYER",
      "LOCAL 2-PLAYER VERSUS",
      "Head-to-head local multiplayer on one keyboard. Test your reflexes.",
      0x0a84ff,
      () => {
        GameSession.mode = "PVP";
        this.modeBadge.setText("CURRENT MODE: PVP");
        this.scene.start("CharacterScene");
      },
    );

    const btnBack = createArcadeButton(
      this,
      width / 2,
      height - 105,
      "BACK TO MAIN MENU",
      () => {
        this.showMainPanel();
      },
      { width: 280, height: 46, accentColor: 0x8e8e93, fontSize: "18px" },
    );

    this.panelContainer.add([header, sub, pveCard, pvpCard, btnBack]);
  }

  createModeCard(x, y, title, subtitle, desc, accentHex, onSelect) {
    const cardW = 390;
    const cardH = 260;
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    const drawCard = (hover) => {
      bg.clear();
      bg.fillStyle(hover ? 0x24161c : 0x151520, 0.95);
      bg.lineStyle(3, hover ? 0xffd60a : accentHex, 1);
      bg.strokeRect(-cardW / 2, -cardH / 2, cardW, cardH);
      bg.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);

      bg.fillStyle(hover ? 0xffd60a : accentHex, 1);
      bg.fillRect(-cardW / 2, -cardH / 2, cardW, 8);
    };
    drawCard(false);

    const tTitle = this.add
      .text(0, -75, title, {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "34px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const tSub = this.add
      .text(0, -35, subtitle, {
        fontSize: "14px",
        fontStyle: "bold",
        color: "#ffd60a",
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    const tDesc = this.add
      .text(0, 20, desc, {
        fontSize: "16px",
        color: "#c8c8d0",
        align: "center",
        wordWrap: { width: cardW - 50 },
      })
      .setOrigin(0.5);

    const selectBtn = createArcadeButton(this, 0, 90, "SELECT MODE", onSelect, {
      width: 220,
      height: 42,
      accentColor: accentHex,
      fontSize: "17px",
    });

    container.add([bg, tTitle, tSub, tDesc, selectBtn]);
    return container;
  }

  showSettingsPanel() {
    this.clearPanel();
    const { width, height } = this.scale;
    const s = GameSession.settings;

    const header = this.add
      .text(width / 2, 115, "GAME SETTINGS", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "48px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x14141f, 0.95);
    panelBg.lineStyle(2, 0xff9f0a, 0.8);
    panelBg.fillRect(width / 2 - 360, 165, 720, 380);
    panelBg.strokeRect(width / 2 - 360, 165, 720, 380);

    const bgmLabel = this.add.text(width / 2 - 310, 215, "MUSIC VOLUME", {
      fontSize: "20px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    const bgmValue = this.add
      .text(width / 2 + 80, 215, `${s.bgmVolume}%`, {
        fontSize: "20px",
        fontStyle: "bold",
        color: "#ffd60a",
      })
      .setOrigin(0.5, 0);

    const btnBgmDown = createArcadeButton(
      this,
      width / 2 - 20,
      228,
      "-",
      () => {
        const next = Math.max(0, GameSession.settings.bgmVolume - 10);
        saveSettings({ bgmVolume: next });
        bgmValue.setText(`${next}%`);
      },
      { width: 60, height: 38 },
    );

    const btnBgmUp = createArcadeButton(
      this,
      width / 2 + 180,
      228,
      "+",
      () => {
        const next = Math.min(100, GameSession.settings.bgmVolume + 10);
        saveSettings({ bgmVolume: next });
        bgmValue.setText(`${next}%`);
      },
      { width: 60, height: 38 },
    );

    const sfxLabel = this.add.text(width / 2 - 310, 295, "SFX VOLUME", {
      fontSize: "20px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    const sfxValue = this.add
      .text(width / 2 + 80, 295, `${s.sfxVolume}%`, {
        fontSize: "20px",
        fontStyle: "bold",
        color: "#ffd60a",
      })
      .setOrigin(0.5, 0);

    const btnSfxDown = createArcadeButton(
      this,
      width / 2 - 20,
      308,
      "-",
      () => {
        const next = Math.max(0, GameSession.settings.sfxVolume - 10);
        saveSettings({ sfxVolume: next });
        sfxValue.setText(`${next}%`);
      },
      { width: 60, height: 38 },
    );

    const btnSfxUp = createArcadeButton(
      this,
      width / 2 + 180,
      308,
      "+",
      () => {
        const next = Math.min(100, GameSession.settings.sfxVolume + 10);
        saveSettings({ sfxVolume: next });
        sfxValue.setText(`${next}%`);
      },
      { width: 60, height: 38 },
    );

    const diffLabel = this.add.text(width / 2 - 310, 375, "AI DIFFICULTY", {
      fontSize: "20px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    const diffs = ["Easy", "Normal", "Hard"];
    const btnDiff = createArcadeButton(
      this,
      width / 2 + 80,
      388,
      s.aiDifficulty.toUpperCase(),
      () => {
        const idx =
          (diffs.indexOf(GameSession.settings.aiDifficulty) + 1) % diffs.length;
        const next = diffs[idx];
        saveSettings({ aiDifficulty: next });
        btnDiff.setLabel(next.toUpperCase());
      },
      { width: 220, height: 40, accentColor: 0xff9f0a },
    );

    const roundLabel = this.add.text(width / 2 - 310, 455, "MATCH FORMAT", {
      fontSize: "20px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    const formatText = (r) =>
      r === 2 ? "BEST OF 3 (2 WINS)" : "SINGLE ROUND (1 WIN)";
    const btnRound = createArcadeButton(
      this,
      width / 2 + 80,
      468,
      formatText(s.roundsToWin),
      () => {
        const next = GameSession.settings.roundsToWin === 2 ? 1 : 2;
        saveSettings({ roundsToWin: next });
        btnRound.setLabel(formatText(next));
      },
      { width: 260, height: 40, accentColor: 0xff9f0a, fontSize: "16px" },
    );

    const savedHint = this.add
      .text(
        width / 2,
        520,
        "Preferences are automatically saved to LocalStorage",
        {
          fontSize: "14px",
          color: "#30d158",
        },
      )
      .setOrigin(0.5);

    const btnBack = createArcadeButton(
      this,
      width / 2,
      height - 95,
      "BACK TO MAIN MENU",
      () => {
        this.showMainPanel();
      },
      { width: 280, height: 46, accentColor: 0x8e8e93, fontSize: "18px" },
    );

    this.panelContainer.add([
      header,
      panelBg,
      bgmLabel,
      bgmValue,
      btnBgmDown,
      btnBgmUp,
      sfxLabel,
      sfxValue,
      btnSfxDown,
      btnSfxUp,
      diffLabel,
      btnDiff,
      roundLabel,
      btnRound,
      savedHint,
      btnBack,
    ]);
  }

  showControlsPanel() {
    this.clearPanel();
    const { width, height } = this.scale;

    const header = this.add
      .text(width / 2, 105, "COMBAT CONTROLS", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "46px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const colP1 = this.createControlColumn(
      width / 2 - 260,
      155,
      "PLAYER 1 (KEYBOARD)",
      CONTROLS_INFO.player1,
      0xff3b30,
    );
    const colP2 = this.createControlColumn(
      width / 2 + 260,
      155,
      "PLAYER 2 (KEYBOARD)",
      CONTROLS_INFO.player2,
      0x0a84ff,
    );

    const note = this.add
      .text(
        width / 2,
        height - 145,
        "Tip: Ensure browser window is focused during combat. Numpad or top-row number keys are both supported for P2.",
        { fontSize: "14px", color: "#b0b0ba" },
      )
      .setOrigin(0.5);

    const btnBack = createArcadeButton(
      this,
      width / 2,
      height - 90,
      "BACK TO MAIN MENU",
      () => {
        this.showMainPanel();
      },
      { width: 280, height: 46, accentColor: 0x8e8e93, fontSize: "18px" },
    );

    this.panelContainer.add([header, colP1, colP2, note, btnBack]);
  }

  createControlColumn(x, topY, title, bindings, accentHex) {
    const colW = 470;
    const colH = 380;
    const container = this.add.container(x, topY);

    const bg = this.add.graphics();
    bg.fillStyle(0x14141f, 0.95);
    bg.lineStyle(2, accentHex, 0.9);
    bg.fillRect(-colW / 2, 0, colW, colH);
    bg.strokeRect(-colW / 2, 0, colW, colH);

    bg.fillStyle(accentHex, 1);
    bg.fillRect(-colW / 2, 0, colW, 42);

    const header = this.add
      .text(0, 21, title, {
        fontSize: "18px",
        fontStyle: "bold",
        color: "#ffffff",
        letterSpacing: 1,
      })
      .setOrigin(0.5);

    container.add([bg, header]);

    bindings.forEach((item, index) => {
      const rowY = 72 + index * 42;
      if (index % 2 === 1) {
        const stripe = this.add.rectangle(
          0,
          rowY,
          colW - 8,
          36,
          0xffffff,
          0.03,
        );
        container.add(stripe);
      }

      const actText = this.add
        .text(-colW / 2 + 24, rowY, item.action, {
          fontSize: "16px",
          color: "#e0e0e6",
        })
        .setOrigin(0, 0.5);

      const keyBadge = this.add
        .text(colW / 2 - 24, rowY, item.key, {
          fontSize: "15px",
          fontStyle: "bold",
          color: "#ffd60a",
          backgroundColor: "#262636",
          padding: { x: 10, y: 4 },
        })
        .setOrigin(1, 0.5);

      container.add([actText, keyBadge]);
    });

    return container;
  }

  showCreditsPanel() {
    this.clearPanel();
    const { width, height } = this.scale;

    const header = this.add
      .text(width / 2, 130, "CREDITS", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "48px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const box = this.add.graphics();
    box.fillStyle(0x14141f, 0.95);
    box.lineStyle(2, 0xff3b30, 0.8);
    box.fillRect(width / 2 - 330, 185, 660, 310);
    box.strokeRect(width / 2 - 330, 185, 660, 310);

    const creditsText = this.add
      .text(
        width / 2,
        340,
        "FACE FIGHTER — MVP BUILD\n\n" +
          "Engine & Tech Stack: Phaser 3 + Vanilla JS (ES Modules) + Vite\n" +
          "Genre: 2D Side-View Arcade Fighting Game\n" +
          "Key Feature: Custom Face-Personalized Fighters\n\n" +
          "Designed & Developed according to Face Fighter PRD v1.0",
        {
          fontSize: "18px",
          color: "#dcdce6",
          align: "center",
          lineSpacing: 10,
        },
      )
      .setOrigin(0.5);

    const btnBack = createArcadeButton(
      this,
      width / 2,
      height - 105,
      "BACK TO MAIN MENU",
      () => {
        this.showMainPanel();
      },
      { width: 280, height: 46, accentColor: 0x8e8e93, fontSize: "18px" },
    );

    this.panelContainer.add([header, box, creditsText, btnBack]);
  }
}
