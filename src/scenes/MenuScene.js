import Phaser from "phaser";
import { GAME_BRAND, CHARACTERS, CONTROLS_INFO } from "../config/gameData.js";
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

    this.add.text(
      28,
      18,
      `${GAME_BRAND.title}  //  ${GAME_BRAND.edition} ${GAME_BRAND.version}`,
      {
        fontFamily: '"Rajdhani", sans-serif',
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ff453a",
        letterSpacing: 1.5,
      },
    );

    this.modeBadge = this.add
      .text(width - 155, 18, `ACTIVE MODE: ${GameSession.mode}`, {
        fontFamily: '"Rajdhani", sans-serif',
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ffd60a",
        letterSpacing: 1,
      })
      .setOrigin(1, 0);

    this.add
      .text(
        width / 2,
        height - 21,
        "2.5D ARCADE FIGHTING ENGINE  •  DESKTOP KEYBOARD & MOBILE TOUCH SUPPORTED  •  ONLINE MULTIPLAYER READY",
        {
          fontFamily: '"Rajdhani", sans-serif',
          fontSize: "13px",
          fontStyle: "bold",
          color: "#9e9eaa",
          letterSpacing: 1,
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

    const logoPlate = this.add.graphics();
    logoPlate.fillStyle(0xff3b30, 0.14);
    logoPlate.beginPath();
    logoPlate.moveTo(68, 92);
    logoPlate.lineTo(560, 92);
    logoPlate.lineTo(530, 232);
    logoPlate.lineTo(68, 232);
    logoPlate.closePath();
    logoPlate.fillPath();

    logoPlate.lineStyle(3, 0xff3b30, 0.9);
    logoPlate.beginPath();
    logoPlate.moveTo(68, 92);
    logoPlate.lineTo(68, 232);
    logoPlate.lineTo(530, 232);
    logoPlate.strokePath();

    const badgeTop = this.add.text(86, 98, "TEKKEN-STYLE 2.5D COMBAT", {
      fontFamily: '"Rajdhani", sans-serif',
      fontSize: "15px",
      fontStyle: "bold",
      color: "#ffd60a",
      backgroundColor: "#2b0c0e",
      padding: { x: 10, y: 2 },
    });

    const titleShadow = this.add.text(88, 120, GAME_BRAND.title, {
      fontFamily: '"Teko", Impact, "Arial Black", sans-serif',
      fontSize: "96px",
      fontStyle: "bold",
      color: "#2a0404",
    });

    const titleMain = this.add.text(82, 114, GAME_BRAND.title, {
      fontFamily: '"Teko", Impact, "Arial Black", sans-serif',
      fontSize: "96px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#ff3b30",
      strokeThickness: 6,
    });

    const tagline = this.add.text(86, 204, GAME_BRAND.subtitle, {
      fontFamily: '"Rajdhani", sans-serif',
      fontSize: "17px",
      fontStyle: "bold",
      color: "#ffd60a",
      letterSpacing: 3,
    });

    const showcaseContainer = this.createLiveFighterShowcase(
      width * 0.71,
      height * 0.54,
    );

    const startX = 245;
    const startY = 305;
    const gap = 64;

    const btnPlay = createArcadeButton(
      this,
      startX,
      startY,
      "ENTER ARENA (PLAY)",
      () => {
        this.showModeSelectPanel();
      },
      { width: 320, height: 54, accentColor: 0xff3b30, fontSize: "28px" },
    );

    const btnOnlineQuick = createArcadeButton(
      this,
      startX,
      startY + gap,
      "ONLINE MULTIPLAYER",
      () => {
        GameSession.mode = "ONLINE";
        this.modeBadge.setText("ACTIVE MODE: ONLINE");
        this.scene.start("OnlineLobbyScene");
      },
      { width: 320, height: 50, accentColor: 0x30d158, fontSize: "25px" },
    );

    const btnControls = createArcadeButton(
      this,
      startX,
      startY + gap * 2,
      "FIGHTER CONTROLS",
      () => {
        this.showControlsPanel();
      },
      { width: 320, height: 48, accentColor: 0x0a84ff, fontSize: "24px" },
    );

    const btnSettings = createArcadeButton(
      this,
      startX,
      startY + gap * 3,
      "GAME SETTINGS",
      () => {
        this.showSettingsPanel();
      },
      { width: 320, height: 48, accentColor: 0xff9f0a, fontSize: "24px" },
    );

    const btnCredits = createArcadeButton(
      this,
      startX,
      startY + gap * 4,
      "CREDITS & INFO",
      () => {
        this.showCreditsPanel();
      },
      { width: 320, height: 46, accentColor: 0x8e8e93, fontSize: "22px" },
    );

    this.panelContainer.add([
      logoPlate,
      badgeTop,
      titleShadow,
      titleMain,
      tagline,
      showcaseContainer,
      btnPlay,
      btnOnlineQuick,
      btnControls,
      btnSettings,
      btnCredits,
    ]);
  }

  createLiveFighterShowcase(centerX, centerY) {
    const container = this.add.container(centerX, centerY);
    const stageGfx = this.add.graphics();

    stageGfx.fillStyle(0xff3b30, 0.1);
    stageGfx.fillEllipse(0, 145, 540, 88);
    stageGfx.lineStyle(3, 0xff3b30, 0.75);
    stageGfx.strokeEllipse(0, 145, 520, 76);
    stageGfx.lineStyle(1.5, 0xffd60a, 0.5);
    stageGfx.strokeEllipse(0, 145, 460, 56);

    stageGfx.lineStyle(2, 0xffd60a, 0.28);
    stageGfx.strokeCircle(0, -10, 210);
    stageGfx.lineStyle(4, 0xff3b30, 0.35);
    stageGfx.beginPath();
    stageGfx.arc(0, -10, 232, -0.7, 0.9, false);
    stageGfx.strokePath();
    stageGfx.beginPath();
    stageGfx.arc(0, -10, 232, 2.4, 4.0, false);
    stageGfx.strokePath();

    const p1Shadow = this.add.ellipse(-135, 142, 130, 26, 0x000000, 0.7);
    const p2Shadow = this.add.ellipse(135, 142, 130, 26, 0x000000, 0.7);

    const ramaChar = CHARACTERS[0];
    const junChar = CHARACTERS[1];

    const ramaSprite = this.add
      .sprite(-135, 148, ramaChar.textureKey, 0)
      .setOrigin(0.5, 1)
      .setScale(0.95)
      .setFlipX(false);
    ramaSprite.play(`${ramaChar.id}_idle`);

    const junSprite = this.add
      .sprite(135, 148, junChar.textureKey, 0)
      .setOrigin(0.5, 1)
      .setScale(0.95)
      .setFlipX(true);
    junSprite.play(`${junChar.id}_idle`);

    const vsGlow = this.add.circle(0, 5, 42, 0xff3b30, 0.28);
    const vsText = this.add
      .text(0, 5, "VS", {
        fontFamily: '"Teko", Impact, "Arial Black", sans-serif',
        fontSize: "78px",
        fontStyle: "bold",
        color: "#ffd60a",
        stroke: "#ff3b30",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: [vsText, vsGlow],
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 850,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const p1Plate = this.add
      .text(-135, 178, 'RAMA "SHADE STRIKER"', {
        fontFamily: '"Rajdhani", sans-serif',
        fontSize: "15px",
        fontStyle: "bold",
        color: "#ffffff",
        backgroundColor: "#9e1b1b",
        padding: { x: 12, y: 4 },
      })
      .setOrigin(0.5);

    const p2Plate = this.add
      .text(135, 178, 'JUN "CAPTAIN XTREME"', {
        fontFamily: '"Rajdhani", sans-serif',
        fontSize: "15px",
        fontStyle: "bold",
        color: "#ffffff",
        backgroundColor: "#0a589e",
        padding: { x: 12, y: 4 },
      })
      .setOrigin(0.5);

    const bannerTop = this.add
      .text(0, -195, "FEATURED MAIN EVENT RIVALRY", {
        fontFamily: '"Rajdhani", sans-serif',
        fontSize: "15px",
        fontStyle: "bold",
        color: "#ffd60a",
        backgroundColor: "#161624",
        padding: { x: 16, y: 4 },
      })
      .setOrigin(0.5);

    container.add([
      stageGfx,
      p1Shadow,
      p2Shadow,
      ramaSprite,
      junSprite,
      vsGlow,
      vsText,
      p1Plate,
      p2Plate,
      bannerTop,
    ]);

    return container;
  }

  showModeSelectPanel() {
    this.clearPanel();
    const { width, height } = this.scale;

    const header = this.add
      .text(width / 2, 108, "SELECT COMBAT MODE", {
        fontFamily: '"Teko", Impact, "Arial Black", sans-serif',
        fontSize: "62px",
        color: "#ffffff",
        stroke: "#ff3b30",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const sub = this.add
      .text(
        width / 2,
        156,
        "Choose Solo Arcade vs AI, Local 2-Player on 1 Keyboard, or Cross-Device Online Battle",
        {
          fontFamily: '"Rajdhani", sans-serif',
          fontSize: "17px",
          fontStyle: "bold",
          color: "#c8c8d4",
        },
      )
      .setOrigin(0.5);

    const cardWidth = 355;
    const spacing = 380;

    const pveCard = this.createCompactModeCard(
      width / 2 - spacing,
      height / 2 - 8,
      cardWidth,
      "PLAYER VS AI",
      "SINGLE PLAYER ARCADE",
      "Battle computer-controlled JUN with adaptive Easy, Normal, or Hard AI.",
      0xff3b30,
      () => {
        GameSession.mode = "PVE";
        this.modeBadge.setText("ACTIVE MODE: PVE");
        this.scene.start("CharacterScene");
      },
    );

    const pvpCard = this.createCompactModeCard(
      width / 2,
      height / 2 - 8,
      cardWidth,
      "LOCAL 2P VERSUS",
      "SAME DEVICE KEYBOARD",
      "Head-to-head local versus on one keyboard (WASD+FGHR vs Arrows+JKLI).",
      0x0a84ff,
      () => {
        GameSession.mode = "PVP";
        this.modeBadge.setText("ACTIVE MODE: PVP");
        this.scene.start("CharacterScene");
      },
    );

    const onlineCard = this.createCompactModeCard(
      width / 2 + spacing,
      height / 2 - 8,
      cardWidth,
      "ONLINE BATTLE",
      "PHONE VS LAPTOP / 2 DEVICES",
      "Create or Join a 6-digit Room Code for real-time internet multiplayer.",
      0x30d158,
      () => {
        GameSession.mode = "ONLINE";
        this.modeBadge.setText("ACTIVE MODE: ONLINE");
        this.scene.start("OnlineLobbyScene");
      },
    );

    const diffs = ["Easy", "Normal", "Hard"];
    const btnCycleDiff = createArcadeButton(
      this,
      width / 2 - 175,
      height - 92,
      `AI DIFFICULTY: ${GameSession.settings.aiDifficulty.toUpperCase()}`,
      () => {
        const idx =
          (diffs.indexOf(GameSession.settings.aiDifficulty) + 1) % diffs.length;
        const nextDiff = diffs[idx];
        saveSettings({ aiDifficulty: nextDiff });
        btnCycleDiff.setLabel(`AI DIFFICULTY: ${nextDiff.toUpperCase()}`);
      },
      { width: 290, height: 44, accentColor: 0xff9f0a, fontSize: "21px" },
    );

    const btnBack = createArcadeButton(
      this,
      width / 2 + 175,
      height - 92,
      "BACK TO MAIN MENU",
      () => {
        this.showMainPanel();
      },
      { width: 290, height: 44, accentColor: 0x8e8e93, fontSize: "21px" },
    );

    this.panelContainer.add([
      header,
      sub,
      pveCard,
      pvpCard,
      onlineCard,
      btnCycleDiff,
      btnBack,
    ]);
  }

  createCompactModeCard(
    x,
    y,
    cardW,
    title,
    subtitle,
    desc,
    accentHex,
    onSelect,
  ) {
    const cardH = 255;
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x181928, 0x181928, 0x0d0e18, 0x0d0e18, 0.96);
    bg.lineStyle(3, accentHex, 1);
    bg.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
    bg.strokeRect(-cardW / 2, -cardH / 2, cardW, cardH);

    bg.fillStyle(accentHex, 1);
    bg.fillRect(-cardW / 2, -cardH / 2, cardW, 10);

    const tTitle = this.add
      .text(0, -68, title, {
        fontFamily: '"Teko", Impact, "Arial Black", sans-serif',
        fontSize: "42px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const tSub = this.add
      .text(0, -28, subtitle, {
        fontFamily: '"Rajdhani", sans-serif',
        fontSize: "14px",
        fontStyle: "bold",
        color: "#ffd60a",
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    const tDesc = this.add
      .text(0, 22, desc, {
        fontFamily: '"Rajdhani", sans-serif',
        fontSize: "16px",
        fontStyle: "bold",
        color: "#d0d0dc",
        align: "center",
        wordWrap: { width: cardW - 36 },
      })
      .setOrigin(0.5);

    const selectBtn = createArcadeButton(this, 0, 88, "LAUNCH MODE", onSelect, {
      width: 220,
      height: 42,
      accentColor: accentHex,
      fontSize: "22px",
    });

    container.add([bg, tTitle, tSub, tDesc, selectBtn]);
    return container;
  }

  showSettingsPanel() {
    this.clearPanel();
    const { width, height } = this.scale;
    const s = GameSession.settings;

    const header = this.add
      .text(width / 2, 102, "SYSTEM & GAME SETTINGS", {
        fontFamily: '"Teko", Impact, "Arial Black", sans-serif',
        fontSize: "56px",
        color: "#ffffff",
        stroke: "#ff9f0a",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x11121d, 0.96);
    panelBg.lineStyle(2.5, 0xff9f0a, 0.9);
    panelBg.fillRect(width / 2 - 360, 148, 720, 420);
    panelBg.strokeRect(width / 2 - 360, 148, 720, 420);

    const labelStyle = {
      fontFamily: '"Rajdhani", sans-serif',
      fontSize: "21px",
      fontStyle: "bold",
      color: "#ffffff",
    };

    const bgmLabel = this.add.text(
      width / 2 - 310,
      188,
      "MUSIC VOLUME",
      labelStyle,
    );
    const bgmValue = this.add
      .text(width / 2 + 80, 188, `${s.bgmVolume}%`, {
        ...labelStyle,
        color: "#ffd60a",
      })
      .setOrigin(0.5, 0);

    const btnBgmDown = createArcadeButton(
      this,
      width / 2 - 20,
      200,
      "-",
      () => {
        const next = Math.max(0, GameSession.settings.bgmVolume - 10);
        saveSettings({ bgmVolume: next });
        bgmValue.setText(`${next}%`);
      },
      { width: 64, height: 36, fontSize: "24px" },
    );

    const btnBgmUp = createArcadeButton(
      this,
      width / 2 + 180,
      200,
      "+",
      () => {
        const next = Math.min(100, GameSession.settings.bgmVolume + 10);
        saveSettings({ bgmVolume: next });
        bgmValue.setText(`${next}%`);
      },
      { width: 64, height: 36, fontSize: "24px" },
    );

    const sfxLabel = this.add.text(
      width / 2 - 310,
      256,
      "COMBAT SFX VOLUME",
      labelStyle,
    );
    const sfxValue = this.add
      .text(width / 2 + 80, 256, `${s.sfxVolume}%`, {
        ...labelStyle,
        color: "#ffd60a",
      })
      .setOrigin(0.5, 0);

    const btnSfxDown = createArcadeButton(
      this,
      width / 2 - 20,
      268,
      "-",
      () => {
        const next = Math.max(0, GameSession.settings.sfxVolume - 10);
        saveSettings({ sfxVolume: next });
        sfxValue.setText(`${next}%`);
      },
      { width: 64, height: 36, fontSize: "24px" },
    );

    const btnSfxUp = createArcadeButton(
      this,
      width / 2 + 180,
      268,
      "+",
      () => {
        const next = Math.min(100, GameSession.settings.sfxVolume + 10);
        saveSettings({ sfxVolume: next });
        sfxValue.setText(`${next}%`);
      },
      { width: 64, height: 36, fontSize: "24px" },
    );

    const diffLabel = this.add.text(
      width / 2 - 310,
      324,
      "AI DIFFICULTY",
      labelStyle,
    );
    const diffs = ["Easy", "Normal", "Hard"];
    const btnDiff = createArcadeButton(
      this,
      width / 2 + 80,
      336,
      s.aiDifficulty.toUpperCase(),
      () => {
        const idx =
          (diffs.indexOf(GameSession.settings.aiDifficulty) + 1) % diffs.length;
        const next = diffs[idx];
        saveSettings({ aiDifficulty: next });
        btnDiff.setLabel(next.toUpperCase());
      },
      { width: 230, height: 38, accentColor: 0xff9f0a, fontSize: "21px" },
    );

    const roundLabel = this.add.text(width / 2 - 310, 392, 'MATCH FORMAT', labelStyle);
    const formatText = (r) => (r === 3 ? 'BEST OF 5 (3 WINS)' : 'BEST OF 3 (2 WINS)');
    const btnRound = createArcadeButton(this, width / 2 + 80, 404, formatText(s.roundsToWin), () => {
      const next = GameSession.settings.roundsToWin === 3 ? 2 : 3;
      saveSettings({ roundsToWin: next });
      btnRound.setLabel(formatText(next));
    }, { width: 260, height: 38, accentColor: 0xff9f0a, fontSize: '20px' });

    const touchLabel = this.add.text(
      width / 2 - 310,
      460,
      "MOBILE TOUCH CONTROLS",
      labelStyle,
    );
    const touchModes = ["AUTO", "ON", "OFF"];
    const currentTouchPref = s.touchControls || "AUTO";
    const btnTouch = createArcadeButton(
      this,
      width / 2 + 80,
      472,
      `MODE: ${currentTouchPref}`,
      () => {
        const cur = GameSession.settings.touchControls || "AUTO";
        const idx = (touchModes.indexOf(cur) + 1) % touchModes.length;
        const next = touchModes[idx];
        saveSettings({ touchControls: next });
        btnTouch.setLabel(`MODE: ${next}`);
      },
      { width: 230, height: 38, accentColor: 0x0a84ff, fontSize: "20px" },
    );

    const savedHint = this.add
      .text(
        width / 2,
        534,
        "All settings are automatically saved to LocalStorage",
        {
          fontFamily: '"Rajdhani", sans-serif',
          fontSize: "15px",
          fontStyle: "bold",
          color: "#30d158",
        },
      )
      .setOrigin(0.5);

    const btnBack = createArcadeButton(
      this,
      width / 2,
      height - 84,
      "BACK TO MAIN MENU",
      () => {
        this.showMainPanel();
      },
      { width: 280, height: 44, accentColor: 0x8e8e93, fontSize: "21px" },
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
      touchLabel,
      btnTouch,
      savedHint,
      btnBack,
    ]);
  }

  showControlsPanel() {
    this.clearPanel();
    const { width, height } = this.scale;

    const header = this.add
      .text(width / 2, 98, "FIGHTER COMMAND LIST & CONTROLS", {
        fontFamily: '"Teko", Impact, "Arial Black", sans-serif',
        fontSize: "56px",
        color: "#ffffff",
        stroke: "#0a84ff",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const colP1 = this.createControlColumn(
      width / 2 - 260,
      148,
      "PLAYER 1 — RAMA",
      CONTROLS_INFO.player1,
      0xff3b30,
    );
    const colP2 = this.createControlColumn(
      width / 2 + 260,
      148,
      "PLAYER 2 — JUN",
      CONTROLS_INFO.player2,
      0x0a84ff,
    );

    const note = this.add
      .text(
        width / 2,
        height - 135,
        "Mobile Players: Virtual Touch D-Pad & Action Buttons appear automatically on touchscreen devices.",
        {
          fontFamily: '"Rajdhani", sans-serif',
          fontSize: "16px",
          fontStyle: "bold",
          color: "#ffd60a",
        },
      )
      .setOrigin(0.5);

    const btnBack = createArcadeButton(
      this,
      width / 2,
      height - 82,
      "BACK TO MAIN MENU",
      () => {
        this.showMainPanel();
      },
      { width: 280, height: 44, accentColor: 0x8e8e93, fontSize: "21px" },
    );

    this.panelContainer.add([header, colP1, colP2, note, btnBack]);
  }

  createControlColumn(x, topY, title, bindings, accentHex) {
    const colW = 480;
    const colH = 385;
    const container = this.add.container(x, topY);

    const bg = this.add.graphics();
    bg.fillStyle(0x11121d, 0.96);
    bg.lineStyle(2.5, accentHex, 0.95);
    bg.fillRect(-colW / 2, 0, colW, colH);
    bg.strokeRect(-colW / 2, 0, colW, colH);

    bg.fillStyle(accentHex, 1);
    bg.fillRect(-colW / 2, 0, colW, 44);

    const header = this.add
      .text(0, 22, title, {
        fontFamily: '"Teko", Impact, "Arial Black", sans-serif',
        fontSize: "28px",
        color: "#ffffff",
        letterSpacing: 1.5,
      })
      .setOrigin(0.5);

    container.add([bg, header]);

    bindings.forEach((item, index) => {
      const rowY = 74 + index * 43;
      if (index % 2 === 1) {
        const stripe = this.add.rectangle(
          0,
          rowY,
          colW - 8,
          36,
          0xffffff,
          0.04,
        );
        container.add(stripe);
      }

      const actText = this.add
        .text(-colW / 2 + 22, rowY, item.action, {
          fontFamily: '"Rajdhani", sans-serif',
          fontSize: "17px",
          fontStyle: "bold",
          color: "#e5e5f0",
        })
        .setOrigin(0, 0.5);

      const keyBadge = this.add
        .text(colW / 2 - 22, rowY, item.key, {
          fontFamily: "monospace",
          fontSize: "14px",
          fontStyle: "bold",
          color: "#ffd60a",
          backgroundColor: "#232438",
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
      .text(width / 2, 118, `ABOUT ${GAME_BRAND.title}`, {
        fontFamily: '"Teko", Impact, "Arial Black", sans-serif',
        fontSize: "60px",
        color: "#ffffff",
        stroke: "#ff3b30",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const box = this.add.graphics();
    box.fillStyle(0x11121d, 0.96);
    box.lineStyle(3, 0xff3b30, 0.9);
    box.fillRect(width / 2 - 360, 175, 720, 320);
    box.strokeRect(width / 2 - 360, 175, 720, 320);

    const creditsText = this.add
      .text(
        width / 2,
        335,
        `${GAME_BRAND.title} — ${GAME_BRAND.edition}\n\n` +
          'Featured Fighters: RAMA "Shade Striker"  vs  JUN "Captain Xtreme"\n' +
          "Engine & Architecture: Phaser 3 WebGL + Node.js Authoritative Socket.IO\n" +
          "Modes: Single-Player vs AI  •  Local 2P Keyboard  •  Cross-Device Online Battle\n" +
          "Platform Support: Desktop Browser & Mobile Landscape Touch Controller",
        {
          fontFamily: '"Rajdhani", sans-serif',
          fontSize: "19px",
          fontStyle: "bold",
          color: "#e0e0ea",
          align: "center",
          lineSpacing: 12,
        },
      )
      .setOrigin(0.5);

    const btnBack = createArcadeButton(
      this,
      width / 2,
      height - 92,
      "BACK TO MAIN MENU",
      () => {
        this.showMainPanel();
      },
      { width: 280, height: 46, accentColor: 0x8e8e93, fontSize: "21px" },
    );

    this.panelContainer.add([header, box, creditsText, btnBack]);
  }
}
