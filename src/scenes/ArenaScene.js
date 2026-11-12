import Phaser from "phaser";
import { ARENAS } from "../config/gameData.js";
import {
  GameSession,
  drawArcadeBackground,
  createArcadeButton,
} from "../utils/helpers.js";

export default class ArenaScene extends Phaser.Scene {
  constructor() {
    super("ArenaScene");
  }

  create() {
    const { width, height } = this.scale;
    drawArcadeBackground(this, 0xff9f0a);

    const firstUnlocked = ARENAS.find((a) => a.unlocked) || ARENAS[0];
    if (!GameSession.arena || !GameSession.arena.unlocked) {
      GameSession.arena = firstUnlocked;
    }

    this.add
      .text(width / 2, 34, "SELECT 2.5D BATTLE STAGE", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "38px",
        color: "#ffffff",
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    const p2Label = GameSession.mode === "PVE" ? "AI" : "P2";
    this.add
      .text(
        width / 2,
        82,
        `P1: ${GameSession.p1Character.fullTitle}   VS   ${p2Label}: ${GameSession.p2Character.fullTitle}`,
        {
          fontSize: "15px",
          fontStyle: "bold",
          color: "#ffd60a",
        },
      )
      .setOrigin(0.5);

    this.previewContainer = this.add.container(width / 2, 252);

    this.noticeText = this.add
      .text(
        width / 2,
        406,
        "ACTIVE STAGE: DRAGON TEMPLE COURTYARD  •  ADDITIONAL STAGES COMING SOON",
        {
          fontSize: "13px",
          fontStyle: "bold",
          color: "#30d158",
          backgroundColor: "#10101acc",
          padding: { x: 14, y: 5 },
        },
      )
      .setOrigin(0.5);

    this.arenaButtons = [];
    const startX = width / 2 - ((ARENAS.length - 1) * 340) / 2;
    ARENAS.forEach((arena, idx) => {
      const card = this.createArenaOption(startX + idx * 340, 505, arena);
      this.arenaButtons.push({ arena, card });
    });

    createArcadeButton(
      this,
      220,
      height - 48,
      "BACK TO FIGHTERS",
      () => {
        this.scene.start("CharacterScene");
      },
      { width: 250, height: 42, accentColor: 0x8e8e93, fontSize: "17px" },
    );

    createArcadeButton(
      this,
      width - 220,
      height - 48,
      "ENTER 2.5D ARENA",
      () => {
        if (!GameSession.arena || !GameSession.arena.unlocked) {
          GameSession.arena = firstUnlocked;
        }
        this.scene.start("BattleScene");
      },
      { width: 290, height: 44, accentColor: 0xff3b30, fontSize: "18px" },
    );

    this.refreshArenaPreview();
  }

  refreshArenaPreview() {
    this.previewContainer.removeAll(true);
    const arena = GameSession.arena;
    const w = 780;
    const h = 245;

    const g = this.add.graphics();
    g.fillStyle(arena.skyColor, 1);
    g.fillRect(-w / 2, -h / 2, w, h);

    if (
      arena.unlocked &&
      arena.textureKey &&
      this.textures.exists(arena.textureKey)
    ) {
      const img = this.add.image(0, 0, arena.textureKey).setDisplaySize(w, h);
      this.previewContainer.add(img);
    } else {
      g.fillStyle(arena.floorColor, 1);
      g.fillRect(-w / 2, -h / 2 + h * 0.65, w, h * 0.35);
      this.previewContainer.add(g);
    }

    const border = this.add.graphics();
    border.lineStyle(3, 0xffd60a, 1);
    border.strokeRect(-w / 2, -h / 2, w, h);

    const title = this.add
      .text(0, -h / 2 + 30, arena.name, {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "32px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    const sub = this.add
      .text(0, -h / 2 + 66, arena.subtitle, {
        fontSize: "15px",
        fontStyle: "bold",
        color: "#ffd60a",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const statusBadge = this.add
      .text(0, h / 2 - 22, "STAGE READY FOR BATTLE", {
        fontSize: "12px",
        fontStyle: "bold",
        color: "#30d158",
        backgroundColor: "#000000cc",
        padding: { x: 12, y: 4 },
      })
      .setOrigin(0.5);

    this.previewContainer.add([border, title, sub, statusBadge]);

    this.arenaButtons.forEach(({ arena: item, card }) => {
      card.setSelectedState(item.id === arena.id);
    });
  }

  createArenaOption(x, y, arena) {
    const w = 310;
    const h = 128;
    const isUnlocked = Boolean(arena.unlocked);
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    const draw = (isSelected, isHover) => {
      bg.clear();
      const alphaFill = isUnlocked ? 0.95 : 0.45;
      bg.fillStyle(arena.skyColor, alphaFill);
      bg.fillRect(-w / 2, -h / 2, w, h * 0.65);
      bg.fillStyle(arena.floorColor, alphaFill);
      bg.fillRect(-w / 2, -h / 2 + h * 0.65, w, h * 0.35);

      if (!isUnlocked) {
        bg.fillStyle(0x09090f, 0.72);
        bg.fillRect(-w / 2, -h / 2, w, h);
      }

      const borderCol = !isUnlocked
        ? 0x555562
        : isSelected
          ? 0xffd60a
          : isHover
            ? 0xffffff
            : arena.accentColor;

      bg.lineStyle(isSelected ? 4 : 2, borderCol, 1);
      bg.strokeRect(-w / 2, -h / 2, w, h);
    };

    const name = this.add
      .text(0, -24, arena.name, {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "19px",
        color: isUnlocked ? "#ffffff" : "#8e8e98",
        align: "center",
        wordWrap: { width: w - 24 },
      })
      .setOrigin(0.5);

    const sub = this.add
      .text(0, 4, arena.subtitle, {
        fontSize: "11px",
        color: isUnlocked ? "#c8c8d2" : "#686872",
        align: "center",
        wordWrap: { width: w - 24 },
      })
      .setOrigin(0.5);

    const badgeText = isUnlocked ? "SELECTED" : "LOCKED — COMING SOON";
    const status = this.add
      .text(0, 36, badgeText, {
        fontSize: "12px",
        fontStyle: "bold",
        color: isUnlocked ? "#111111" : "#ffd60a",
        backgroundColor: isUnlocked ? "#ffd60a" : "#262632",
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5);

    const hit = this.add
      .rectangle(0, 0, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: isUnlocked });

    let selectedFlag = false;
    hit.on("pointerover", () => {
      if (isUnlocked) draw(selectedFlag, true);
    });
    hit.on("pointerout", () => {
      if (isUnlocked) draw(selectedFlag, false);
    });
    hit.on("pointerdown", () => {
      if (!isUnlocked) {
        this.noticeText.setText(`${arena.name} IS LOCKED (COMING SOON)`);
        this.noticeText.setColor("#ffd60a");
        this.tweens.killTweensOf(container);
        container.x = x;
        this.tweens.add({
          targets: container,
          x: x + 6,
          duration: 45,
          yoyo: true,
          repeat: 2,
          onComplete: () => {
            container.x = x;
          },
        });
        return;
      }
      GameSession.arena = arena;
      this.noticeText.setText(`SELECTED STAGE: ${arena.name}`);
      this.noticeText.setColor("#30d158");
      this.refreshArenaPreview();
    });

    container.add([bg, name, sub, status, hit]);
    container.setSelectedState = (isSel) => {
      selectedFlag = isSel && isUnlocked;
      status.setVisible(isUnlocked ? isSel : true);
      draw(selectedFlag, false);
    };

    return container;
  }
}
