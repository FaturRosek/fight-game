import { CHARACTER_ANIMATIONS } from "../config/gameData.js";

export const FRAME_WIDTH = 240;
export const FRAME_HEIGHT = 320;
export const FRAMES_PER_ROW = 4;

export function buildCharacterTextures(scene, characters) {
  characters.forEach((char) => {
    const rawKey = resolveValidRawTextureKey(scene, char);
    let extractedPoses = rawKey
      ? extractFourPosesFromSheet(scene, rawKey, char)
      : null;
    if (!extractedPoses || extractedPoses.length < 4) {
      extractedPoses = synthesizePreRenderedFighterPoses(char);
    }
    generatePreRenderedAtlas(scene, char, extractedPoses);
    registerCharacterAnimations(scene, char);
  });
}

function resolveValidRawTextureKey(scene, char) {
  const paths = char.candidatePaths || [char.assetPath];
  for (let idx = 0; idx < paths.length; idx++) {
    const candidateKey = `${char.textureKey}_raw_${idx}`;
    if (scene.textures.exists(candidateKey)) {
      const src = scene.textures.get(candidateKey).getSourceImage();
      if (src && src.width > 64 && src.height > 64) {
        return candidateKey;
      }
    }
  }
  const fallbackSingleKey = `${char.textureKey}_raw`;
  if (scene.textures.exists(fallbackSingleKey)) {
    const src = scene.textures.get(fallbackSingleKey).getSourceImage();
    if (src && src.width > 64 && src.height > 64) {
      return fallbackSingleKey;
    }
  }
  return null;
}

function extractFourPosesFromSheet(scene, rawKey, char) {
  const sourceImg = scene.textures.get(rawKey).getSourceImage();
  if (!sourceImg || !sourceImg.width || sourceImg.width < 64) return null;

  const cleanCanvas = document.createElement("canvas");
  cleanCanvas.width = sourceImg.width;
  cleanCanvas.height = sourceImg.height;
  const cleanCtx = cleanCanvas.getContext("2d");
  cleanCtx.drawImage(sourceImg, 0, 0);

  const imgData = cleanCtx.getImageData(
    0,
    0,
    cleanCanvas.width,
    cleanCanvas.height,
  );
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const saturation = maxC - minC;
    const brightness = (r + g + b) / 3;

    if (brightness > 240 && saturation < 18) {
      data[i + 3] = 0;
    } else if (brightness > 222 && saturation < 24) {
      const alphaFactor = (240 - brightness) / 18;
      data[i + 3] = Math.max(0, Math.min(255, Math.floor(alphaFactor * 255)));
    }
  }
  cleanCtx.putImageData(imgData, 0, 0);

  const sliceWidth = Math.floor(cleanCanvas.width / 4);
  const sliceHeight = cleanCanvas.height;
  const poses = [];

  for (let i = 0; i < 4; i++) {
    const sx = i * sliceWidth;
    const bounds = findContentBounds(cleanCtx, sx, 0, sliceWidth, sliceHeight);
    const poseCanvas = document.createElement("canvas");
    poseCanvas.width = FRAME_WIDTH;
    poseCanvas.height = FRAME_HEIGHT;
    const pCtx = poseCanvas.getContext("2d");

    const targetHeight = FRAME_HEIGHT * 0.86;
    const scale = Math.min(
      (FRAME_WIDTH * 0.88) / Math.max(1, bounds.w),
      targetHeight / Math.max(1, bounds.h),
    );

    const drawW = bounds.w * scale;
    const drawH = bounds.h * scale;
    const drawX = (FRAME_WIDTH - drawW) / 2;
    const drawY = FRAME_HEIGHT - 18 - drawH;

    pCtx.save();
    if (i === 3 && char && char.role === "player2") {
      pCtx.translate(FRAME_WIDTH, 0);
      pCtx.scale(-1, 1);
    }
    pCtx.drawImage(
      cleanCanvas,
      bounds.x,
      bounds.y,
      bounds.w,
      bounds.h,
      drawX,
      drawY,
      drawW,
      drawH,
    );
    pCtx.restore();
    poses.push(poseCanvas);
  }

  void char;
  return poses;
}

function isKickPoseFacingLeft(ctx, bounds) {
  const midX = bounds.x + Math.floor(bounds.w / 2);
  const upperH = Math.floor(bounds.h * 0.65);
  const leftData = ctx.getImageData(
    bounds.x,
    bounds.y,
    Math.max(1, midX - bounds.x),
    Math.max(1, upperH),
  ).data;
  const rightData = ctx.getImageData(
    midX,
    bounds.y,
    Math.max(1, bounds.x + bounds.w - midX),
    Math.max(1, upperH),
  ).data;

  let leftMass = 0;
  let rightMass = 0;

  for (let i = 3; i < leftData.length; i += 4) {
    if (leftData[i] > 40) leftMass++;
  }
  for (let i = 3; i < rightData.length; i += 4) {
    if (rightData[i] > 40) rightMass++;
  }

  return leftMass >= rightMass * 0.85;
}

function findContentBounds(ctx, startX, startY, width, height) {
  const imgData = ctx.getImageData(startX, startY, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = imgData[(y * width + x) * 4 + 3];
      if (alpha > 25) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) {
    return { x: startX, y: startY, w: width, h: height };
  }

  const pad = 6;
  const bx = Math.max(0, minX - pad);
  const by = Math.max(0, minY - pad);
  const bw = Math.min(width - bx, maxX - minX + pad * 2);
  const bh = Math.min(height - by, maxY - minY + pad * 2);

  return { x: startX + bx, y: startY + by, w: bw, h: bh };
}

function synthesizePreRenderedFighterPoses(char) {
  const poseTypes = ["idle", "walk", "punch", "kick"];
  return poseTypes.map((poseType) => {
    const canvas = document.createElement("canvas");
    canvas.width = FRAME_WIDTH;
    canvas.height = FRAME_HEIGHT;
    const ctx = canvas.getContext("2d");
    drawDetailed25DFighterPose(ctx, char, poseType);
    return canvas;
  });
}

function drawShadedLimb(ctx, x1, y1, x2, y2, thickness, cLight, cMid, cDark) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const perpX = -Math.sin(angle) * (thickness / 2);
  const perpY = Math.cos(angle) * (thickness / 2);

  const grad = ctx.createLinearGradient(
    x1 + perpX,
    y1 + perpY,
    x1 - perpX,
    y1 - perpY,
  );
  grad.addColorStop(0, cLight);
  grad.addColorStop(0.55, cMid);
  grad.addColorStop(1, cDark);

  ctx.strokeStyle = grad;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawDetailed25DFighterPose(ctx, char, poseType) {
  const isRama = char.role === "player1";
  const cx = FRAME_WIDTH / 2 - 6;
  const footY = FRAME_HEIGHT - 22;

  const skinLight = "#d79b6e";
  const skinMid = "#b37649";
  const skinDark = "#6e4224";

  const hipX = poseType === "punch" ? cx + 8 : cx;
  const hipY = 178;
  const shoulderX =
    poseType === "punch" ? cx + 14 : poseType === "kick" ? cx - 8 : cx + 2;
  const shoulderY = 104;
  const headX = shoulderX + 4;
  const headY = 64;

  const backHipX = hipX - 14;
  const frontHipX = hipX + 14;

  let backKneeX = backHipX - 16;
  let backKneeY = 232;
  let backAnkleX = backHipX - 28;
  let backAnkleY = footY - 8;

  let frontKneeX = frontHipX + 18;
  let frontKneeY = 230;
  let frontAnkleX = frontHipX + 26;
  let frontAnkleY = footY - 8;

  if (poseType === "walk") {
    backKneeX = backHipX - 8;
    backAnkleX = backHipX - 12;
    frontKneeX = frontHipX + 24;
    frontAnkleX = frontHipX + 34;
  } else if (poseType === "kick") {
    backKneeX = hipX - 6;
    backAnkleX = hipX - 10;
    frontKneeX = hipX + 44;
    frontKneeY = 152;
    frontAnkleX = hipX + 94;
    frontAnkleY = 126;
  }

  const pantsLight = isRama ? "#9e9c98" : "#2e313a";
  const pantsMid = isRama ? "#73716d" : "#1b1d24";
  const pantsDark = isRama ? "#454340" : "#0d0e12";

  drawShadedLimb(
    ctx,
    backHipX,
    hipY,
    backKneeX,
    backKneeY,
    24,
    pantsLight,
    pantsMid,
    pantsDark,
  );
  drawShadedLimb(
    ctx,
    backKneeX,
    backKneeY,
    backAnkleX,
    backAnkleY,
    21,
    pantsLight,
    pantsMid,
    pantsDark,
  );

  drawBootOrFoot(ctx, isRama, backAnkleX, backAnkleY, false);

  drawShadedLimb(
    ctx,
    shoulderX - 14,
    shoulderY + 6,
    shoulderX - 2,
    shoulderY + 42,
    16,
    skinLight,
    skinMid,
    skinDark,
  );
  drawShadedLimb(
    ctx,
    shoulderX - 2,
    shoulderY + 42,
    shoulderX + 26,
    shoulderY + 22,
    15,
    skinLight,
    skinMid,
    skinDark,
  );
  drawFighterGlove(ctx, isRama, shoulderX + 30, shoulderY + 20);

  ctx.save();
  const torsoGrad = ctx.createLinearGradient(
    shoulderX - 30,
    shoulderY,
    shoulderX + 34,
    hipY,
  );
  if (isRama) {
    torsoGrad.addColorStop(0, "#f5f2eb");
    torsoGrad.addColorStop(0.6, "#d6d0c4");
    torsoGrad.addColorStop(1, "#9c968b");
  } else {
    torsoGrad.addColorStop(0, "#36786a");
    torsoGrad.addColorStop(0.55, "#215247");
    torsoGrad.addColorStop(1, "#102b25");
  }

  ctx.fillStyle = torsoGrad;
  ctx.beginPath();
  ctx.moveTo(shoulderX - 26, shoulderY - 4);
  ctx.lineTo(shoulderX + 26, shoulderY - 4);
  ctx.lineTo(hipX + 22, hipY + 8);
  ctx.lineTo(hipX - 24, hipY + 8);
  ctx.closePath();
  ctx.fill();

  if (isRama) {
    ctx.strokeStyle = "#9e1b1b";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = "#18181d";
    ctx.fillRect(hipX - 25, hipY - 8, 50, 10);
  } else {
    ctx.strokeStyle = "#0d241f";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = "rgba(12, 28, 24, 0.75)";
    ctx.font = "bold 11px Impact, sans-serif";
    ctx.fillText("XTREME", shoulderX - 14, shoulderY + 36);
  }
  ctx.restore();

  drawShadedLimb(
    ctx,
    frontHipX,
    hipY,
    frontKneeX,
    frontKneeY,
    25,
    pantsLight,
    pantsMid,
    pantsDark,
  );
  drawShadedLimb(
    ctx,
    frontKneeX,
    frontKneeY,
    frontAnkleX,
    frontAnkleY,
    22,
    pantsLight,
    pantsMid,
    pantsDark,
  );

  if (!isRama) {
    ctx.strokeStyle = "#e6b822";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(frontHipX + 4, hipY + 2);
    ctx.lineTo(frontKneeX + 4, frontKneeY);
    ctx.lineTo(frontAnkleX + 2, frontAnkleY - 4);
    ctx.stroke();

    ctx.strokeStyle = "#c92a2a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(frontHipX, hipY + 4);
    ctx.lineTo(frontKneeX, frontKneeY + 2);
    ctx.lineTo(frontAnkleX - 2, frontAnkleY - 4);
    ctx.stroke();
  }

  drawBootOrFoot(ctx, isRama, frontAnkleX, frontAnkleY, poseType === "kick");

  drawShadedLimb(
    ctx,
    headX - 2,
    headY + 18,
    shoulderX,
    shoulderY,
    16,
    skinLight,
    skinMid,
    skinDark,
  );

  ctx.save();
  const faceGrad = ctx.createRadialGradient(
    headX + 6,
    headY - 4,
    4,
    headX,
    headY,
    26,
  );
  faceGrad.addColorStop(0, "#e0a577");
  faceGrad.addColorStop(0.65, "#b87b4d");
  faceGrad.addColorStop(1, "#6e4123");

  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.ellipse(headX, headY, 21, 25, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#141212";
  ctx.beginPath();
  ctx.arc(headX - 2, headY - 6, 22, Math.PI * 0.95, Math.PI * 2.05);
  ctx.fill();

  if (isRama) {
    ctx.fillStyle = "#0a0a0e";
    ctx.fillRect(headX - 4, headY - 7, 24, 11);
    ctx.strokeStyle = "#2e2b2b";
    ctx.lineWidth = 2;
    ctx.strokeRect(headX - 4, headY - 7, 24, 11);
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(headX - 2, headY - 6, 3, 3);
  } else {
    const capGrad = ctx.createLinearGradient(
      headX - 24,
      headY - 30,
      headX + 24,
      headY - 4,
    );
    capGrad.addColorStop(0, "#c9934b");
    capGrad.addColorStop(0.6, "#9e6d2d");
    capGrad.addColorStop(1, "#664318");

    ctx.fillStyle = capGrad;
    ctx.beginPath();
    ctx.arc(headX - 1, headY - 8, 23, Math.PI * 0.98, Math.PI * 2.02);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#875a21";
    ctx.beginPath();
    ctx.moveTo(headX - 22, headY - 10);
    ctx.lineTo(headX - 42, headY - 1);
    ctx.lineTo(headX - 18, headY - 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#1f1916";
    ctx.fillRect(headX + 4, headY - 14, 14, 5);

    ctx.fillStyle = "#1a1210";
    ctx.beginPath();
    ctx.arc(headX + 10, headY - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#5c2818";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(headX + 6, headY + 11);
    ctx.lineTo(headX + 15, headY + 10);
    ctx.stroke();
  }
  ctx.restore();

  let frontElbX = shoulderX - 6;
  let frontElbY = shoulderY + 38;
  let frontWristX = shoulderX + 22;
  let frontWristY = shoulderY + 14;

  if (poseType === "punch") {
    frontElbX = shoulderX + 34;
    frontElbY = shoulderY + 6;
    frontWristX = shoulderX + 76;
    frontWristY = shoulderY + 4;
  } else if (poseType === "walk") {
    frontElbX = shoulderX + 4;
    frontElbY = shoulderY + 36;
    frontWristX = shoulderX + 32;
    frontWristY = shoulderY + 20;
  }

  drawShadedLimb(
    ctx,
    shoulderX,
    shoulderY + 6,
    frontElbX,
    frontElbY,
    17,
    skinLight,
    skinMid,
    skinDark,
  );
  drawShadedLimb(
    ctx,
    frontElbX,
    frontElbY,
    frontWristX,
    frontWristY,
    15,
    skinLight,
    skinMid,
    skinDark,
  );
  drawFighterGlove(ctx, isRama, frontWristX + 4, frontWristY);
}

function drawFighterGlove(ctx, isRama, x, y) {
  const grad = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, 12);
  if (isRama) {
    grad.addColorStop(0, "#ff4d3d");
    grad.addColorStop(0.6, "#b81d13");
    grad.addColorStop(1, "#5e0b06");
  } else {
    grad.addColorStop(0, "#3a3d47");
    grad.addColorStop(0.6, "#1f2129");
    grad.addColorStop(1, "#0d0e12");
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.fill();
}

function drawBootOrFoot(ctx, isRama, x, y, isKick) {
  ctx.save();
  ctx.translate(x, y);
  if (isKick) ctx.rotate(-0.35);

  if (isRama) {
    ctx.fillStyle = "#c4875a";
    ctx.beginPath();
    ctx.roundRect(-10, -4, 28, 12, 5);
    ctx.fill();
  } else {
    const shoeGrad = ctx.createLinearGradient(-12, -8, 22, 10);
    shoeGrad.addColorStop(0, "#2e3834");
    shoeGrad.addColorStop(1, "#121715");
    ctx.fillStyle = shoeGrad;
    ctx.beginPath();
    ctx.roundRect(-12, -6, 32, 15, 5);
    ctx.fill();
    ctx.fillStyle = "#0a0c0b";
    ctx.fillRect(-12, 5, 32, 4);
  }
  ctx.restore();
}

function generatePreRenderedAtlas(scene, char, poses) {
  const animKeys = Object.keys(CHARACTER_ANIMATIONS);
  const sheetWidth = FRAME_WIDTH * FRAMES_PER_ROW;
  const sheetHeight = FRAME_HEIGHT * animKeys.length;

  const canvas = document.createElement("canvas");
  canvas.width = sheetWidth;
  canvas.height = sheetHeight;
  const ctx = canvas.getContext("2d");

  animKeys.forEach((stateName, rowIndex) => {
    for (let colIndex = 0; colIndex < FRAMES_PER_ROW; colIndex++) {
      const cellX = colIndex * FRAME_WIDTH;
      const cellY = rowIndex * FRAME_HEIGHT;
      ctx.save();
      ctx.translate(cellX, cellY);
      renderPoseSequenceFrame(ctx, char, poses, stateName, colIndex);
      ctx.restore();
    }
  });

  if (scene.textures.exists(char.textureKey)) {
    scene.textures.remove(char.textureKey);
  }

  const canvasTexture = scene.textures.addCanvas(char.textureKey, canvas);
  let frameIndex = 0;
  for (let row = 0; row < animKeys.length; row++) {
    for (let col = 0; col < FRAMES_PER_ROW; col++) {
      canvasTexture.add(
        frameIndex,
        0,
        col * FRAME_WIDTH,
        row * FRAME_HEIGHT,
        FRAME_WIDTH,
        FRAME_HEIGHT,
      );
      frameIndex++;
    }
  }
}

function renderPoseSequenceFrame(ctx, char, poses, stateName, colIndex) {
  const idlePose = poses[0];
  const walkPose = poses[1];
  const punchPose = poses[2];
  const kickPose = poses[3];
  const isP1 = char.role === "player1";

  let selectedPose = idlePose;
  let offsetX = 0;
  let offsetY = 0;
  let scaleX = 1;
  let scaleY = 1;
  let rotation = 0;
  let filterEffect = "none";
  let drawStrikeArc = null;

  const footAnchorX = FRAME_WIDTH / 2;
  const footAnchorY = FRAME_HEIGHT - 18;

  if (stateName === "idle") {
    selectedPose = idlePose;
    const breath = Math.sin((colIndex / 4) * Math.PI * 2);
    scaleY = 1 + breath * 0.018;
    offsetY = -breath * 2;
  } else if (stateName === "walk") {
    selectedPose = colIndex % 2 === 0 ? idlePose : walkPose;
    offsetX = colIndex === 1 ? 8 : colIndex === 3 ? -6 : 0;
    offsetY = colIndex % 2 === 1 ? -5 : 0;
  } else if (stateName === "jump") {
    selectedPose = colIndex === 1 || colIndex === 2 ? kickPose : walkPose;
    offsetY = colIndex === 1 || colIndex === 2 ? -34 : -16;
    rotation = -0.04;
  } else if (stateName === "crouch") {
    selectedPose = idlePose;
    scaleY = 0.78;
    scaleX = 1.06;
  } else if (stateName === "punch") {
    if (colIndex === 0) {
      selectedPose = walkPose;
      offsetX = -8;
      rotation = -0.04;
    } else if (colIndex === 1) {
      selectedPose = punchPose;
      offsetX = 20;
      rotation = 0.05;
      drawStrikeArc = "punch";
    } else if (colIndex === 2) {
      selectedPose = punchPose;
      offsetX = 14;
      rotation = 0.03;
    } else {
      selectedPose = idlePose;
      offsetX = 3;
    }
  } else if (stateName === "kick") {
    if (colIndex === 0) {
      selectedPose = walkPose;
      offsetX = -6;
      rotation = -0.05;
    } else if (colIndex === 1) {
      selectedPose = kickPose;
      offsetX = 18;
      rotation = -0.04;
      drawStrikeArc = "kick";
    } else if (colIndex === 2) {
      selectedPose = kickPose;
      offsetX = 12;
      rotation = -0.02;
    } else {
      selectedPose = idlePose;
      offsetX = 2;
    }
  } else if (stateName === "block") {
    selectedPose = idlePose;
    offsetX = -10;
    scaleX = 0.95;
    rotation = -0.03;
    filterEffect = "brightness(0.95) contrast(1.12)";
  } else if (stateName === "hit") {
    selectedPose = walkPose;
    offsetX = colIndex === 1 || colIndex === 2 ? -18 : -10;
    rotation = colIndex === 1 || colIndex === 2 ? -0.16 : -0.09;
    filterEffect =
      colIndex === 0 || colIndex === 1
        ? "brightness(1.3) saturate(1.35)"
        : "none";
  } else if (stateName === "special") {
    if (colIndex === 0) {
      selectedPose = idlePose;
      offsetX = -12;
      scaleY = 0.94;
    } else if (colIndex === 1) {
      selectedPose = punchPose;
      offsetX = 24;
      rotation = 0.06;
      drawStrikeArc = "special";
    } else if (colIndex === 2) {
      selectedPose = kickPose;
      offsetX = 26;
      rotation = -0.04;
      drawStrikeArc = "special";
    } else {
      selectedPose = walkPose;
      offsetX = 8;
    }
    filterEffect = "contrast(1.18) saturate(1.3)";
  } else if (stateName === "victory") {
    selectedPose = colIndex % 2 === 0 ? idlePose : punchPose;
    offsetY = colIndex % 2 === 1 ? -8 : 0;
  } else if (stateName === "defeat") {
    selectedPose = walkPose;
    const progress = (colIndex + 1) / 4;
    rotation = -0.35 * progress;
    scaleY = 1 - 0.25 * progress;
    offsetY = 18 * progress;
  }

  ctx.save();
  if (stateName === "special" && colIndex >= 1) {
    const auraGrad = ctx.createRadialGradient(
      footAnchorX + offsetX,
      footAnchorY - 135,
      15,
      footAnchorX + offsetX,
      footAnchorY - 135,
      110,
    );
    auraGrad.addColorStop(
      0,
      isP1 ? "rgba(255, 70, 40, 0.55)" : "rgba(20, 160, 255, 0.55)",
    );
    auraGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(footAnchorX + offsetX, footAnchorY - 135, 110, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.translate(footAnchorX + offsetX, footAnchorY + offsetY);
  ctx.rotate(rotation);
  ctx.scale(scaleX, scaleY);
  if (filterEffect !== "none") {
    ctx.filter = filterEffect;
  }
  ctx.drawImage(selectedPose, -footAnchorX, -footAnchorY);
  ctx.restore();

  if (drawStrikeArc) {
    ctx.save();
    const arcColor =
      drawStrikeArc === "special"
        ? isP1
          ? "rgba(255, 80, 40, 0.78)"
          : "rgba(60, 190, 255, 0.78)"
        : "rgba(255, 220, 90, 0.65)";
    ctx.strokeStyle = arcColor;
    ctx.lineWidth = drawStrikeArc === "special" ? 9 : 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (drawStrikeArc === "Punch" || drawStrikeArc === "punch") {
      ctx.moveTo(footAnchorX + 20, footAnchorY - 185);
      ctx.quadraticCurveTo(
        footAnchorX + 78,
        footAnchorY - 190,
        footAnchorX + 104,
        footAnchorY - 178,
      );
    } else {
      ctx.moveTo(footAnchorX + 16, footAnchorY - 110);
      ctx.quadraticCurveTo(
        footAnchorX + 86,
        footAnchorY - 165,
        footAnchorX + 108,
        footAnchorY - 210,
      );
    }
    ctx.stroke();
    ctx.restore();
  }
}

function registerCharacterAnimations(scene, char) {
  const animKeys = Object.keys(CHARACTER_ANIMATIONS);
  animKeys.forEach((stateName, rowIndex) => {
    const config = CHARACTER_ANIMATIONS[stateName];
    const fullAnimKey = `${char.id}_${stateName}`;
    if (scene.anims.exists(fullAnimKey)) {
      scene.anims.remove(fullAnimKey);
    }

    const startFrame = rowIndex * FRAMES_PER_ROW;
    const endFrame = startFrame + config.frames - 1;

    scene.anims.create({
      key: fullAnimKey,
      frames: scene.anims.generateFrameNumbers(char.textureKey, {
        start: startFrame,
        end: endFrame,
      }),
      frameRate: config.frameRate,
      repeat: config.repeat,
    });
  });
}
