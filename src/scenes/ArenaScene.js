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
        84,
        `P1: ${GameSession.p1Character.fullTitle}   VS   ${p2Label}: ${GameSession.p2Character.fullTitle}`,
        {
          fontSize: "16px",
          fontStyle: "bold",
          color: "#ffd60a",
        },
      )
      .setOrigin(0.5);

    this.previewContainer = this.add.container(width / 2, 260);

    this.arenaButtons = [];
    const startX = width / 2 - ((ARENAS.length - 1) * 340) / 2;
    ARENAS.forEach((arena, idx) => {
      const card = this.createArenaOption(startX + idx * 340, 500, arena);
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
    const h = 250;

    const g = this.add.graphics();
    g.fillStyle(arena.skyColor, 1);
    g.fillRect(-w / 2, -h / 2, w, h);

    if (this.textures.exists(arena.textureKey)) {
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

    this.previewContainer.add([border, title, sub]);

    this.arenaButtons.forEach(({ arena: item, card }) => {
      card.setSelectedState(item.id === arena.id);
    });
  }

  createArenaOption(x, y, arena) {
    const w = 310;
    const h = 125;
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    const draw = (isSelected, isHover) => {
      bg.clear();
      bg.fillStyle(arena.skyColor, 0.95);
      bg.fillRect(-w / 2, -h / 2, w, h * 0.65);
      bg.fillStyle(arena.floorColor, 0.95);
      bg.fillRect(-w / 2, -h / 2 + h * 0.65, w, h * 0.35);

      const borderCol = isSelected
        ? 0xffd60a
        : isHover
          ? 0xffffff
          : arena.accentColor;
      bg.lineStyle(isSelected ? 4 : 2, borderCol, 1);
      bg.strokeRect(-w / 2, -h / 2, w, h);
    };

    const name = this.add
      .text(0, -18, arena.name, {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "20px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: w - 24 },
      })
      .setOrigin(0.5);

    const status = this.add
      .text(0, 34, "SELECTED", {
        fontSize: "13px",
        fontStyle: "bold",
        color: "#111111",
        backgroundColor: "#ffd60a",
        padding: { x: 10, y: 3 },
      })
      .setOrigin(0.5);

    const hit = this.add
      .rectangle(0, 0, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    let selectedFlag = false;
    hit.on("pointerover", () => draw(selectedFlag, true));
    hit.on("pointerout", () => draw(selectedFlag, false));
    hit.on("pointerdown", () => {
      GameSession.arena = arena;
      this.refreshArenaPreview();
    });

    container.add([bg, name, status, hit]);
    container.setSelectedState = (isSel) => {
      selectedFlag = isSel;
      status.setVisible(isSel);
      draw(isSel, false);
    };

    return container;
  }
}
