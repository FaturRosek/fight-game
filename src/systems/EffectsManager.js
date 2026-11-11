export default class EffectsManager {
  constructor(scene) {
    this.scene = scene;
  }

  spawnHitEffect(x, y, attackState, blocked, facingDir = 1) {
    if (blocked) {
      this.spawnBlockGuardEffect(x, y, facingDir);
      return;
    }

    const isSpecial = attackState === "SPECIAL";
    const isKick = attackState === "KICK";
    const primaryColor = isSpecial ? 0xff3b30 : isKick ? 0xff9f0a : 0xffd60a;
    const coreRadius = isSpecial ? 22 : isKick ? 16 : 12;
    const rayCount = isSpecial ? 14 : isKick ? 10 : 8;
    const outerRadius = isSpecial ? 72 : isKick ? 52 : 38;

    const container = this.scene.add.container(x, y);
    const g = this.scene.add.graphics();

    g.fillStyle(primaryColor, 0.35);
    g.fillCircle(0, 0, coreRadius * 1.9);

    g.fillStyle(0xffffff, 1);
    g.fillCircle(0, 0, coreRadius);

    g.lineStyle(isSpecial ? 4 : 3, primaryColor, 1);
    for (let i = 0; i < rayCount; i++) {
      const baseAngle = (i / rayCount) * Math.PI * 2;
      const innerR = coreRadius * 0.6;
      const rayLen = outerRadius * (i % 2 === 0 ? 1 : 0.68);
      g.lineBetween(
        Math.cos(baseAngle) * innerR,
        Math.sin(baseAngle) * innerR,
        Math.cos(baseAngle) * rayLen + facingDir * 8,
        Math.sin(baseAngle) * rayLen,
      );
    }

    const ring = this.scene.add.circle(0, 0, coreRadius, primaryColor, 0);
    ring.setStrokeStyle(isSpecial ? 4 : 2, 0xffffff, 0.95);

    container.add([g, ring]);

    this.scene.tweens.add({
      targets: ring,
      scaleX: isSpecial ? 3.2 : 2.3,
      scaleY: isSpecial ? 3.2 : 2.3,
      alpha: 0,
      duration: isSpecial ? 260 : 180,
    });

    this.scene.tweens.add({
      targets: container,
      scaleX: 1.45,
      scaleY: 1.45,
      alpha: 0,
      duration: isSpecial ? 270 : 190,
      onComplete: () => container.destroy(),
    });
  }

  spawnBlockGuardEffect(x, y, facingDir = 1) {
    const g = this.scene.add.graphics({ x, y });
    g.lineStyle(4, 0x64d2ff, 1);
    const startAngle = facingDir >= 0 ? -Math.PI * 0.42 : Math.PI * 0.58;
    const endAngle = facingDir >= 0 ? Math.PI * 0.42 : Math.PI * 1.42;

    g.beginPath();
    g.arc(0, 0, 34, startAngle, endAngle, false);
    g.strokePath();

    g.lineStyle(2, 0xffffff, 0.9);
    g.beginPath();
    g.arc(0, 0, 24, startAngle, endAngle, false);
    g.strokePath();

    this.scene.tweens.add({
      targets: g,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 180,
      onComplete: () => g.destroy(),
    });
  }

  spawnSpecialCastFlash(x, y, colorHex = 0xff3b30) {
    const ring = this.scene.add.circle(x, y, 24, colorHex, 0.25);
    ring.setStrokeStyle(3, 0xffd60a, 1);

    this.scene.tweens.add({
      targets: ring,
      scaleX: 3.1,
      scaleY: 3.1,
      alpha: 0,
      duration: 280,
      onComplete: () => ring.destroy(),
    });
  }

  spawnDustPuff(x, groundY, count = 4) {
    for (let i = 0; i < count; i++) {
      const offsetX = (i - (count - 1) / 2) * 16;
      const puff = this.scene.add.circle(
        x + offsetX,
        groundY - 6,
        7 + (i % 2) * 3,
        0xd8cfc2,
        0.45,
      );
      this.scene.tweens.add({
        targets: puff,
        x: puff.x + offsetX * 1.4,
        y: puff.y - 16 - Math.random() * 10,
        scaleX: 1.8,
        scaleY: 1.8,
        alpha: 0,
        duration: 240,
        onComplete: () => puff.destroy(),
      });
    }
  }

  spawnFloatingPopup(x, y, textValue, color = "#ffd60a") {
    const label = this.scene.add
      .text(x, y, textValue, {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "22px",
        color,
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.scene.tweens.add({
      targets: label,
      y: y - 38,
      alpha: 0,
      duration: 460,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  triggerImpactCameraFeedback(attackState, blocked) {
    if (blocked) {
      this.scene.cameras.main.shake(60, 0.0025);
      return;
    }
    if (attackState === "SPECIAL") {
      this.scene.cameras.main.shake(170, 0.009);
    } else if (attackState === "KICK") {
      this.scene.cameras.main.shake(105, 0.005);
    } else {
      this.scene.cameras.main.shake(65, 0.0028);
    }
  }
}
