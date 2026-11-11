import Phaser from "phaser";
import { CHARACTER_ANIMATIONS } from "../config/gameData.js";
import InputManager from "../systems/InputManager.js";
import { GameSession, createArcadeButton } from "../utils/helpers.js";

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");
  }

  create() {
    const { width, height } = this.scale;
    const { arena, p1Character, p2Character } = GameSession;
    this.floorY = height * 0.82;

    this.renderPerspectiveArena(arena, width, height);
    this.renderTekkenHUD(p1Character, p2Character, width);

    this.p1Shadow = this.add.ellipse(
      390,
      this.floorY - 8,
      135,
      26,
      0x000000,
      0.65,
    );
    this.p2Shadow = this.add.ellipse(
      width - 390,
      this.floorY - 8,
      135,
      26,
      0x000000,
      0.65,
    );

    this.p1FighterSprite = this.add
      .sprite(390, this.floorY - 150, p1Character.textureKey, 0)
      .setScale(1.05)
      .setFlipX(false);

    this.p2FighterSprite = this.add
      .sprite(width - 390, this.floorY - 150, p2Character.textureKey, 0)
      .setScale(1.05)
      .setFlipX(true);

    this.p1FighterSprite.play(`${p1Character.id}_idle`);
    this.p2FighterSprite.play(`${p2Character.id}_idle`);

    this.p1FighterSprite.on("animationcomplete", () => {
      this.p1FighterSprite.play(`${p1Character.id}_idle`, true);
    });
    this.p2FighterSprite.on("animationcomplete", () => {
      this.p2FighterSprite.play(`${p2Character.id}_idle`, true);
    });

    this.inputManager = new InputManager(this);

    this.inputStatusText = this.add
      .text(
        width / 2,
        115,
        "P1 KEYS: [W,A,S,D + F,G,H,R]   |   P2 KEYS: [ARROWS + J,K,L,I]",
        {
          fontSize: "14px",
          fontStyle: "bold",
          color: "#ffd60a",
          backgroundColor: "#000000bb",
          padding: { x: 14, y: 5 },
        },
      )
      .setOrigin(0.5);

    this.buildAnimationTestBar(width, height, p1Character, p2Character);
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
      vignette.fillStyle(0x000000, 0.22);
      vignette.fillRect(0, 0, width, 110);
      return;
    }

    const horizonY = height * 0.56;
    const g = this.add.graphics();

    g.fillGradientStyle(arena.skyColor, arena.skyColor, 0x1e1318, 0x1e1318, 1);
    g.fillRect(0, 0, width, horizonY);

    g.fillStyle(arena.ambientLight, 0.14);
    g.fillCircle(width * 0.25, horizonY - 40, 160);
    g.fillCircle(width * 0.75, horizonY - 40, 160);

    for (let px = 90; px < width; px += 220) {
      g.fillStyle(0x120d14, 0.95);
      g.fillRect(px - 22, 95, 44, horizonY - 95);
      g.lineStyle(2, arena.accentColor, 0.35);
      g.strokeRect(px - 22, 95, 44, horizonY - 95);
    }

    g.fillGradientStyle(
      0x1b151e,
      0x1b151e,
      arena.floorColor,
      arena.floorColor,
      1,
    );
    g.fillRect(0, horizonY, width, height - horizonY);

    g.lineStyle(1, 0xffffff, 0.08);
    const vanishX = width / 2;
    for (let i = -12; i <= 12; i++) {
      const topX = vanishX + i * 45;
      const bottomX = vanishX + i * 135;
      g.lineBetween(topX, horizonY, bottomX, height);
    }

    for (let r = 1; r <= 7; r++) {
      const ratio = Math.pow(r / 7, 1.45);
      const y = horizonY + ratio * (height - horizonY);
      g.lineBetween(0, y, width, y);
    }

    g.lineStyle(3, arena.accentColor, 0.75);
    g.lineBetween(0, horizonY, width, horizonY);
  }

  renderTekkenHUD(p1, p2, width) {
    const hud = this.add.graphics();

    const barW = 460;
    const barH = 26;
    const topY = 36;

    hud.fillStyle(0x1a0808, 0.9);
    hud.fillRect(60, topY, barW, barH);
    hud.fillRect(width - 60 - barW, topY, barW, barH);

    hud.fillGradientStyle(0xffe629, 0xffe629, 0xff2a1a, 0xff2a1a, 1);
    hud.fillRect(63, topY + 3, barW - 6, barH - 6);
    hud.fillRect(width - 60 - barW + 3, topY + 3, barW - 6, barH - 6);

    hud.lineStyle(3, 0xffd60a, 1);
    hud.strokeRect(60, topY, barW, barH);
    hud.strokeRect(width - 60 - barW, topY, barW, barH);

    this.add.text(62, topY + 34, p1.name, {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: "28px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 5,
    });

    this.add
      .text(width - 62, topY + 34, p2.name, {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "28px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(1, 0);

    hud.fillStyle(0xff3b30, 1);
    hud.fillCircle(width / 2 - 76, topY + 46, 8);
    hud.fillCircle(width / 2 + 76, topY + 46, 8);

    this.add
      .text(width / 2, topY + 14, "99", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "54px",
        color: "#ffd60a",
        stroke: "#3a0800",
        strokeThickness: 6,
      })
      .setOrigin(0.5);
  }

  spawnTekkenHitSpark(x, y, colorHex = 0xffd60a) {
    const spark = this.add.graphics({ x, y });
    spark.fillStyle(0xffffff, 1);
    spark.fillCircle(0, 0, 14);
    spark.lineStyle(4, colorHex, 1);

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      spark.lineBetween(
        Math.cos(angle) * 8,
        Math.sin(angle) * 8,
        Math.cos(angle) * 42,
        Math.sin(angle) * 42,
      );
    }

    this.tweens.add({
      targets: spark,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 210,
      onComplete: () => spark.destroy(),
    });
  }

  buildAnimationTestBar(width, height, p1Character, p2Character) {
    const animKeys = Object.keys(CHARACTER_ANIMATIONS);
    const spacingX = 96;
    const startX = width / 2 - ((animKeys.length - 1) * spacingX) / 2;

    animKeys.forEach((animKey, index) => {
      const bx = startX + index * spacingX;
      createArcadeButton(
        this,
        bx,
        height - 76,
        animKey.toUpperCase(),
        () => {
          this.triggerPreviewAction(1, p1Character, animKey);
          this.triggerPreviewAction(2, p2Character, animKey);
        },
        { width: 88, height: 30, accentColor: 0xff9f0a, fontSize: "12px" },
      );
    });

    createArcadeButton(
      this,
      160,
      height - 28,
      "CHANGE FIGHTER",
      () => {
        this.scene.start("CharacterScene");
      },
      { width: 210, height: 34, accentColor: 0x8e8e93, fontSize: "14px" },
    );

    createArcadeButton(
      this,
      width - 160,
      height - 28,
      "MAIN MENU",
      () => {
        this.scene.start("MenuScene");
      },
      { width: 210, height: 34, accentColor: 0xff3b30, fontSize: "14px" },
    );
  }

  triggerPreviewAction(playerNum, char, animKey) {
    const sprite =
      playerNum === 1 ? this.p1FighterSprite : this.p2FighterSprite;
    sprite.play(`${char.id}_${animKey}`, true);

    if (animKey === "punch" || animKey === "kick" || animKey === "special") {
      const sparkX = playerNum === 1 ? sprite.x + 85 : sprite.x - 85;
      const sparkY = sprite.y - 25;
      this.spawnTekkenHitSpark(
        sparkX,
        sparkY,
        animKey === "special" ? 0xff3b30 : 0xffd60a,
      );
    }
  }

  update() {
    if (!this.inputManager) return;
    const { p1Character, p2Character } = GameSession;

    const p1 = this.inputManager.getPlayerState(1);
    const p2 = this.inputManager.getPlayerState(2);

    if (p1.punchPressed) this.triggerPreviewAction(1, p1Character, "punch");
    else if (p1.kickPressed) this.triggerPreviewAction(1, p1Character, "kick");
    else if (p1.specialPressed)
      this.triggerPreviewAction(1, p1Character, "special");
    else if (p1.jumpPressed) this.triggerPreviewAction(1, p1Character, "jump");
    else if (p1.blockHeld) this.triggerPreviewAction(1, p1Character, "block");
    else if (p1.down) this.triggerPreviewAction(1, p1Character, "crouch");
    else if (p1.left || p1.right) {
      const currentKey = this.p1FighterSprite.anims.currentAnim?.key;
      if (currentKey === `${p1Character.id}_idle`) {
        this.p1FighterSprite.play(`${p1Character.id}_walk`, true);
      }
    }

    if (p2.punchPressed) this.triggerPreviewAction(2, p2Character, "punch");
    else if (p2.kickPressed) this.triggerPreviewAction(2, p2Character, "kick");
    else if (p2.specialPressed)
      this.triggerPreviewAction(2, p2Character, "special");
    else if (p2.jumpPressed) this.triggerPreviewAction(2, p2Character, "jump");
    else if (p2.blockHeld) this.triggerPreviewAction(2, p2Character, "block");
    else if (p2.down) this.triggerPreviewAction(2, p2Character, "crouch");
    else if (p2.left || p2.right) {
      const currentKey = this.p2FighterSprite.anims.currentAnim?.key;
      if (currentKey === `${p2Character.id}_idle`) {
        this.p2FighterSprite.play(`${p2Character.id}_walk`, true);
      }
    }
  }
}
