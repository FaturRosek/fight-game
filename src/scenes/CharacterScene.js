import Phaser from "phaser";
import { CHARACTERS } from "../config/gameData.js";
import {
  GameSession,
  drawArcadeBackground,
  createArcadeButton,
} from "../utils/helpers.js";

export default class CharacterScene extends Phaser.Scene {
  constructor() {
    super("CharacterScene");
  }

  create() {
    const { width, height } = this.scale;
    drawArcadeBackground(this, 0xff3b30);

    this.activeSlot = 1;
    this.currentPreviewAnim = "idle";

    this.add
      .text(width / 2, 32, "SELECT YOUR 2.5D FIGHTER", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "38px",
        color: "#ffffff",
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    const opponentLabel =
      GameSession.mode === "PVE" ? "AI OPPONENT" : "PLAYER 2";
    this.turnBanner = this.add
      .text(width / 2, 82, "ACTIVE SELECTION SLOT: PLAYER 1", {
        fontSize: "15px",
        fontStyle: "bold",
        color: "#ffd60a",
        backgroundColor: "#2b1619",
        padding: { x: 16, y: 5 },
      })
      .setOrigin(0.5);

    this.p1PreviewContainer = this.add.container(260, 260);
    this.p2PreviewContainer = this.add.container(width - 260, 260);

    this.add
      .text(width / 2, 205, "VS", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "62px",
        color: "#ff3b30",
        stroke: "#ffd60a",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.btnSwitchSlot = createArcadeButton(
      this,
      width / 2,
      280,
      `SELECT FOR ${opponentLabel}`,
      () => {
        this.activeSlot = this.activeSlot === 1 ? 2 : 1;
        this.updateTurnBanner();
      },
      { width: 240, height: 38, accentColor: 0xff9f0a, fontSize: "15px" },
    );

    const sampleAnims = ["idle", "walk", "punch", "kick", "special", "victory"];
    const animStartX = width / 2 - ((sampleAnims.length - 1) * 92) / 2;
    this.add
      .text(width / 2, 332, "TEST 3D PRE-RENDERED ANIMATION:", {
        fontSize: "12px",
        fontStyle: "bold",
        color: "#b0b0ba",
      })
      .setOrigin(0.5);

    sampleAnims.forEach((animName, idx) => {
      createArcadeButton(
        this,
        animStartX + idx * 92,
        362,
        animName.toUpperCase(),
        () => {
          this.currentPreviewAnim = animName;
          this.playPreviewAnimations(animName);
        },
        { width: 84, height: 30, accentColor: 0x0a84ff, fontSize: "12px" },
      );
    });

    this.rosterCards = [];
    const startX = width / 2 - ((CHARACTERS.length - 1) * 390) / 2;
    CHARACTERS.forEach((char, idx) => {
      const card = this.createFighterCard(startX + idx * 390, 515, char);
      this.rosterCards.push({ char, card });
    });

    createArcadeButton(
      this,
      200,
      height - 44,
      "BACK TO MENU",
      () => {
        this.scene.start("MenuScene");
      },
      { width: 230, height: 40, accentColor: 0x8e8e93, fontSize: "16px" },
    );

    createArcadeButton(
      this,
      width - 220,
      height - 44,
      "SELECT ARENA",
      () => {
        this.scene.start("ArenaScene");
      },
      { width: 290, height: 42, accentColor: 0x30d158, fontSize: "17px" },
    );

    this.refreshPreviews();
    this.updateTurnBanner();
  }

  playPreviewAnimations(animName) {
    if (this.p1Sprite) {
      this.p1Sprite.play(`${GameSession.p1Character.id}_${animName}`, true);
    }
    if (this.p2Sprite) {
      this.p2Sprite.play(`${GameSession.p2Character.id}_${animName}`, true);
    }
  }

  updateTurnBanner() {
    const opponentLabel =
      GameSession.mode === "PVE" ? "AI OPPONENT" : "PLAYER 2";
    if (this.activeSlot === 1) {
      this.turnBanner.setText("ACTIVE SELECTION SLOT: PLAYER 1");
      this.turnBanner.setColor("#ffd60a");
      this.btnSwitchSlot.setLabel(`SELECT FOR ${opponentLabel}`);
    } else {
      this.turnBanner.setText(`ACTIVE SELECTION SLOT: ${opponentLabel}`);
      this.turnBanner.setColor("#64d2ff");
      this.btnSwitchSlot.setLabel("SELECT FOR PLAYER 1");
    }
    this.refreshPreviews();
  }

  refreshPreviews() {
    const opponentLabel =
      GameSession.mode === "PVE" ? "AI OPPONENT" : "PLAYER 2";
    this.p1Sprite = this.renderFighterPreview(
      this.p1PreviewContainer,
      "PLAYER 1",
      GameSession.p1Character,
      0xff3b30,
      this.activeSlot === 1,
      false,
    );
    this.p2Sprite = this.renderFighterPreview(
      this.p2PreviewContainer,
      opponentLabel,
      GameSession.p2Character,
      0x0a84ff,
      this.activeSlot === 2,
      true,
    );

    this.rosterCards.forEach(({ char, card }) => {
      const isP1 = GameSession.p1Character.id === char.id;
      const isP2 = GameSession.p2Character.id === char.id;
      card.updateBadges(isP1, isP2);
    });
  }

  renderFighterPreview(
    container,
    slotTitle,
    char,
    slotHex,
    isActive,
    flipHorizontal,
  ) {
    container.removeAll(true);
    const boxW = 400;
    const boxH = 265;

    const bg = this.add.graphics();
    bg.fillStyle(0x11111a, 0.96);
    bg.lineStyle(isActive ? 3 : 2, isActive ? 0xffd60a : slotHex, 1);
    bg.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
    bg.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

    const floorShadow = this.add.ellipse(-112, 92, 96, 20, 0x000000, 0.6);
    const stageGlow = this.add.circle(-112, 8, 66, char.color, 0.16);
    const sprite = this.add
      .sprite(-112, -2, char.textureKey, 0)
      .setScale(0.68)
      .setFlipX(flipHorizontal);

    sprite.play(`${char.id}_${this.currentPreviewAnim}`);
    sprite.on("animationcomplete", () => {
      if (
        this.currentPreviewAnim !== "idle" &&
        this.currentPreviewAnim !== "walk" &&
        this.currentPreviewAnim !== "victory"
      ) {
        sprite.play(`${char.id}_idle`);
      }
    });

    const badge = this.add.text(-boxW / 2 + 14, -boxH / 2 + 10, slotTitle, {
      fontSize: "13px",
      fontStyle: "bold",
      color: isActive ? "#ffd60a" : "#ffffff",
      backgroundColor: "#262636",
      padding: { x: 8, y: 3 },
    });

    const name = this.add.text(-20, -88, char.fullTitle, {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: "22px",
      color: "#ffffff",
      wordWrap: { width: 205 },
    });

    const origin = this.add.text(-20, -38, char.origin, {
      fontSize: "11px",
      fontStyle: "bold",
      color: "#ffd60a",
    });

    const style = this.add.text(-20, -18, char.style.toUpperCase(), {
      fontSize: "12px",
      color: "#64d2ff",
    });

    const statsY = 12;
    const statLabels = [
      { label: "PWR", val: char.stats.power },
      { label: "SPD", val: char.stats.speed },
      { label: "DEF", val: char.stats.defense },
    ];

    container.add([
      bg,
      floorShadow,
      stageGlow,
      sprite,
      badge,
      name,
      origin,
      style,
    ]);

    statLabels.forEach((st, i) => {
      const y = statsY + i * 22;
      const lbl = this.add.text(-20, y, st.label, {
        fontSize: "12px",
        fontStyle: "bold",
        color: "#b0b0ba",
      });
      const barBg = this.add
        .rectangle(88, y + 7, 130, 9, 0x2c2c3a)
        .setOrigin(0.5);
      const barFill = this.add
        .rectangle(23, y + 7, (st.val / 100) * 130, 9, char.color)
        .setOrigin(0, 0.5);
      container.add([lbl, barBg, barFill]);
    });

    const desc = this.add
      .text(0, boxH / 2 - 22, char.desc, {
        fontSize: "11px",
        color: "#c8c8d2",
        align: "center",
        wordWrap: { width: boxW - 24 },
      })
      .setOrigin(0.5);

    container.add(desc);
    return sprite;
  }

  createFighterCard(x, y, char) {
    const cardW = 350;
    const cardH = 145;
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    const drawCard = (hover) => {
      bg.clear();
      bg.fillStyle(hover ? 0x251822 : 0x161622, 0.96);
      bg.lineStyle(2, hover ? 0xffd60a : char.color, 1);
      bg.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
      bg.strokeRect(-cardW / 2, -cardH / 2, cardW, cardH);
    };
    drawCard(false);

    const miniSprite = this.add
      .sprite(-cardW / 2 + 54, 4, char.textureKey, 0)
      .setScale(0.38);
    miniSprite.play(`${char.id}_idle`);

    const name = this.add.text(-cardW / 2 + 106, -45, char.fullTitle, {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: "20px",
      color: "#ffffff",
      wordWrap: { width: 225 },
    });

    const origin = this.add.text(-cardW / 2 + 106, -14, char.origin, {
      fontSize: "11px",
      fontStyle: "bold",
      color: "#ffd60a",
    });

    const style = this.add.text(-cardW / 2 + 106, 8, char.style, {
      fontSize: "12px",
      color: "#c8c8d2",
    });

    const badgeP1 = this.add.text(
      -cardW / 2 + 12,
      cardH / 2 - 26,
      "P1 SELECTED",
      {
        fontSize: "11px",
        fontStyle: "bold",
        color: "#ffffff",
        backgroundColor: "#ff3b30",
        padding: { x: 8, y: 3 },
      },
    );

    const badgeP2 = this.add
      .text(
        cardW / 2 - 12,
        cardH / 2 - 26,
        GameSession.mode === "PVE" ? "AI SELECTED" : "P2 SELECTED",
        {
          fontSize: "11px",
          fontStyle: "bold",
          color: "#ffffff",
          backgroundColor: "#0a84ff",
          padding: { x: 8, y: 3 },
        },
      )
      .setOrigin(1, 0);

    const hit = this.add
      .rectangle(0, 0, cardW, cardH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    hit.on("pointerover", () => drawCard(true));
    hit.on("pointerout", () => drawCard(false));
    hit.on("pointerdown", () => {
      if (this.activeSlot === 1) {
        GameSession.p1Character = char;
        this.activeSlot = 2;
      } else {
        GameSession.p2Character = char;
      }
      this.updateTurnBanner();
    });

    container.add([bg, miniSprite, name, origin, style, badgeP1, badgeP2, hit]);
    container.updateBadges = (isP1, isP2) => {
      badgeP1.setVisible(isP1);
      badgeP2.setVisible(isP2);
    };

    return container;
  }
}
