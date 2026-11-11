import { CHARACTERS, ARENAS } from "../config/gameData.js";

const SETTINGS_STORAGE_KEY = "face_fighter_settings_v1";

const defaultSettings = {
  bgmVolume: 70,
  sfxVolume: 85,
  aiDifficulty: "Normal",
  roundsToWin: 2,
};

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
  } catch {}
}

export function drawArcadeBackground(scene, primaryHex = 0xff3b30) {
  const { width, height } = scene.scale;
  const bg = scene.add.graphics();

  bg.fillGradientStyle(0x09090d, 0x09090d, 0x1a0e12, 0x12121c, 1);
  bg.fillRect(0, 0, width, height);

  bg.lineStyle(1, 0xffffff, 0.04);
  for (let x = 0; x < width; x += 64) {
    bg.lineBetween(x, 0, x - 120, height);
  }

  bg.fillStyle(0x050508, 0.9);
  bg.fillRect(0, 0, width, 68);
  bg.fillRect(0, height - 48, width, 48);

  bg.lineStyle(2, primaryHex, 0.8);
  bg.lineBetween(0, 68, width, 68);
  bg.lineBetween(0, height - 48, width, height - 48);

  return bg;
}

export function createArcadeButton(scene, x, y, label, onClick, options = {}) {
  const width = options.width || 280;
  const height = options.height || 50;
  const baseColor = options.baseColor ?? 0x1c1c28;
  const accentColor = options.accentColor ?? 0xff3b30;
  const textColor = options.textColor ?? "#ffffff";
  const fontSize = options.fontSize ?? "20px";

  const container = scene.add.container(x, y);
  const bg = scene.add.graphics();

  const drawState = (isHover, isSelected = false) => {
    bg.clear();
    const fill = isHover ? 0x2c1619 : isSelected ? 0x331d00 : baseColor;
    const stroke = isHover ? 0xffd60a : isSelected ? 0xffd60a : accentColor;

    bg.fillStyle(fill, 0.95);
    bg.lineStyle(2, stroke, 1);

    const slant = 12;
    const hw = width / 2;
    const hh = height / 2;

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
    bg.lineTo(-hw + slant + 8, -hh);
    bg.lineTo(-hw + 8, hh);
    bg.lineTo(-hw, hh);
    bg.closePath();
    bg.fillPath();
  };

  drawState(false, options.selected);

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize,
      color: textColor,
      letterSpacing: 2,
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
      duration: 90,
    });
    text.setColor("#ffd60a");
  });

  hitArea.on("pointerout", () => {
    drawState(false, options.selected);
    scene.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      duration: 90,
    });
    text.setColor(textColor);
  });

  hitArea.on("pointerdown", () => {
    scene.tweens.add({
      targets: container,
      scaleX: 0.96,
      scaleY: 0.96,
      duration: 50,
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
