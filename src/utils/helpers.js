import { CHARACTERS, ARENAS } from "../config/gameData.js";
import { soundManager } from "../systems/SoundManager.js";

const SETTINGS_STORAGE_KEY = "face_fighter_settings_v1";

const defaultSettings = {
  bgmVolume: 70,
  sfxVolume: 85,
  aiDifficulty: "Normal",
  roundsToWin: 2,
  touchControls: "AUTO",
};

export function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

export function shouldShowTouchControls() {
  const pref = GameSession?.settings?.touchControls || "AUTO";
  if (pref === "ON") return true;
  if (pref === "OFF") return false;
  return isTouchDevice();
}

export function isPortraitMobile() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < window.innerHeight && window.innerWidth <= 960;
}

export const GameSession = {
  mode: "PVE",
  p1Character: CHARACTERS[0],
  p2Character: CHARACTERS[1],
  arena: ARENAS[0],
  settings: loadSettings(),
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...defaultSettings };
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(newSettings) {
  GameSession.settings = { ...GameSession.settings, ...newSettings };
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(GameSession.settings),
    );
  } catch {
    return;
  }
}

export function drawArcadeBackground(scene, primaryHex = 0xff3b30) {
  const { width, height } = scene.scale;
  const container = scene.add.container(0, 0);

  const baseBg = scene.add.graphics();
  baseBg.fillGradientStyle(0x050509, 0x09060c, 0x180a10, 0x0b0d18, 1);
  baseBg.fillRect(0, 0, width, height);
  container.add(baseBg);

  if (scene.textures.exists("arena_temple")) {
    const templeImg = scene.add
      .image(width / 2, height / 2, "arena_temple")
      .setDisplaySize(width, height)
      .setAlpha(0.22)
      .setTint(0xffb899);
    container.add(templeImg);
  }

  const overlay = scene.add.graphics();
  overlay.fillGradientStyle(0x05050a, 0x05050a, 0x0c070b, 0x140b10, 0.78);
  overlay.fillRect(0, 0, width, height);

  const horizonY = height * 0.72;
  overlay.lineStyle(1, primaryHex, 0.14);
  for (let i = -10; i <= 10; i++) {
    overlay.lineBetween(
      width / 2 + i * 55,
      horizonY,
      width / 2 + i * 165,
      height,
    );
  }
  for (let r = 1; r <= 5; r++) {
    const ry = horizonY + Math.pow(r / 5, 1.4) * (height - horizonY);
    overlay.lineBetween(0, ry, width, ry);
  }

  overlay.fillStyle(primaryHex, 0.08);
  overlay.fillCircle(width * 0.7, height * 0.48, 260);
  overlay.fillStyle(0xffd60a, 0.05);
  overlay.fillCircle(width * 0.25, height * 0.3, 210);

  overlay.fillStyle(0x040407, 0.92);
  overlay.fillRect(0, 0, width, 58);
  overlay.fillRect(0, height - 42, width, 42);

  overlay.lineStyle(2, primaryHex, 0.9);
  overlay.lineBetween(0, 58, width, 58);
  overlay.lineStyle(1, 0xffd60a, 0.5);
  overlay.lineBetween(0, 61, width * 0.45, 61);

  overlay.lineStyle(2, primaryHex, 0.75);
  overlay.lineBetween(0, height - 42, width, height - 42);

  container.add(overlay);

  for (let i = 0; i < 18; i++) {
    const ember = scene.add.circle(
      Math.random() * width,
      height * 0.2 + Math.random() * (height * 0.75),
      1.5 + Math.random() * 2.5,
      i % 3 === 0 ? 0xff3b30 : 0xffaa00,
      0.35 + Math.random() * 0.45,
    );
    container.add(ember);

    scene.tweens.add({
      targets: ember,
      y: ember.y - (90 + Math.random() * 140),
      x: ember.x + (Math.random() * 60 - 30),
      alpha: 0,
      duration: 2400 + Math.random() * 2200,
      repeat: -1,
      onRepeat: () => {
        ember.x = Math.random() * width;
        ember.y = height - 45;
        ember.alpha = 0.4 + Math.random() * 0.45;
      },
    });
  }

  return container;
}

export function createArcadeButton(scene, x, y, label, onClick, options = {}) {
  const width = options.width || 280;
  const height = options.height || 50;
  const baseColor = options.baseColor ?? 0x12131f;
  const accentColor = options.accentColor ?? 0xff3b30;
  const textColor = options.textColor ?? "#ffffff";
  const fontSize = options.fontSize ?? "22px";

  const container = scene.add.container(x, y);
  const bg = scene.add.graphics();

  const drawState = (isHover, isSelected = false) => {
    bg.clear();
    const fillTop = isHover ? 0x381217 : isSelected ? 0x332105 : baseColor;
    const fillBottom = isHover ? 0x1c080b : isSelected ? 0x1c1202 : 0x090a10;
    const stroke = isHover ? 0xffd60a : isSelected ? 0xffd60a : accentColor;

    const slant = 14;
    const hw = width / 2;
    const hh = height / 2;

    if (isHover || isSelected) {
      bg.fillStyle(stroke, 0.18);
      bg.beginPath();
      bg.moveTo(-hw + slant - 4, -hh - 4);
      bg.lineTo(hw + 4, -hh - 4);
      bg.lineTo(hw - slant + 4, hh + 4);
      bg.lineTo(-hw - 4, hh + 4);
      bg.closePath();
      bg.fillPath();
    }

    bg.fillGradientStyle(fillTop, fillTop, fillBottom, fillBottom, 0.96);
    bg.lineStyle(isHover ? 2.5 : 2, stroke, 1);

    bg.beginPath();
    bg.moveTo(-hw + slant, -hh);
    bg.lineTo(hw, -hh);
    bg.lineTo(hw - slant, hh);
    bg.lineTo(-hw, hh);
    bg.closePath();
    bg.fillPath();
    bg.strokePath();

    bg.fillStyle(stroke, 1);
    bg.beginPath();
    bg.moveTo(-hw + slant, -hh);
    bg.lineTo(-hw + slant + 10, -hh);
    bg.lineTo(-hw + 10, hh);
    bg.lineTo(-hw, hh);
    bg.closePath();
    bg.fillPath();

    bg.fillStyle(0xffffff, isHover ? 0.18 : 0.06);
    bg.beginPath();
    bg.moveTo(-hw + slant + 12, -hh + 2);
    bg.lineTo(hw - 4, -hh + 2);
    bg.lineTo(hw - 8, -2);
    bg.lineTo(-hw + slant + 6, -2);
    bg.closePath();
    bg.fillPath();
  };

  drawState(false, options.selected);

  const text = scene.add
    .text(4, 0, label, {
      fontFamily: '"Teko", Impact, "Arial Black", sans-serif',
      fontSize,
      fontStyle: "bold",
      color: textColor,
      letterSpacing: 1.5,
      stroke: "#000000",
      strokeThickness: 3,
    })
    .setOrigin(0.5);

  const hitArea = scene.add
    .rectangle(0, 0, width, height, 0x000000, 0)
    .setInteractive({ useHandCursor: true });

  hitArea.on("pointerover", () => {
    drawState(true, options.selected);
    scene.tweens.add({
      targets: container,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 80,
    });
    text.setColor("#ffd60a");
  });

  hitArea.on("pointerout", () => {
    drawState(false, options.selected);
    scene.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      duration: 80,
    });
    text.setColor(textColor);
  });

  hitArea.on("pointerdown", () => {
    soundManager.playSwing("punch");
    scene.tweens.add({
      targets: container,
      scaleX: 0.95,
      scaleY: 0.95,
      duration: 45,
      yoyo: true,
      onComplete: () => onClick && onClick(),
    });
  });

  container.add([bg, text, hitArea]);
  container.setLabel = (newText) => text.setText(newText);
  container.setSelected = (sel) => {
    options.selected = sel;
    drawState(false, sel);
  };

  return container;
}
