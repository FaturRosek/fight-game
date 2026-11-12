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
    const secondaryColor = isSpecial ? 0xffd60a : 0xffffff;
    const coreRadius = isSpecial ? 22 : isKick ? 16 : 12;
    const rayCount = isSpecial ? 14 : isKick ? 10 : 8;
    const outerRadius = isSpecial ? 74 : isKick ? 52 : 38;

    const container = this.scene.add.container(x, y).setDepth(30);
    const g = this.scene.add.graphics();

    g.fillStyle(primaryColor, 0.38);
    g.fillCircle(0, 0, coreRadius * 1.95);

    g.fillStyle(secondaryColor, 1);
    g.fillCircle(0, 0, coreRadius * 0.9);

    g.lineStyle(isSpecial ? 4 : 3, primaryColor, 1);
    for (let i = 0; i < rayCount; i++) {
      const baseAngle = (i / rayCount) * Math.PI * 2;
      const innerR = coreRadius * 0.55;
      const rayLen = outerRadius * (i % 2 === 0 ? 1 : 0.65);
      g.lineBetween(
        Math.cos(baseAngle) * innerR,
        Math.sin(baseAngle) * innerR,
        Math.cos(baseAngle) * rayLen + facingDir * 10,
        Math.sin(baseAngle) * rayLen,
      );
    }

    if (isKick || isSpecial) {
      g.lineStyle(isSpecial ? 4 : 3, 0xffffff, 0.9);
      g.lineBetween(-26 * facingDir, -22, 34 * facingDir, 22);
      if (isSpecial) {
        g.lineBetween(-26 * facingDir, 22, 34 * facingDir, -22);
      }
    }

    const ring = this.scene.add.circle(0, 0, coreRadius, primaryColor, 0);
    ring.setStrokeStyle(isSpecial ? 4 : 2.5, 0xffffff, 0.95);

    container.add([g, ring]);

    this.scene.tweens.add({
      targets: ring,
      scaleX: isSpecial ? 3.3 : 2.35,
      scaleY: isSpecial ? 3.3 : 2.35,
      alpha: 0,
      duration: isSpecial ? 250 : 175,
    });

    this.scene.tweens.add({
      targets: container,
      scaleX: 1.45,
      scaleY: 1.45,
      alpha: 0,
      duration: isSpecial ? 260 : 185,
      onComplete: () => container.destroy(),
    });
  }

  spawnBlockGuardEffect(x, y, facingDir = 1) {
    const container = this.scene.add.container(x, y).setDepth(30);
    const g = this.scene.add.graphics();

    const startAngle = facingDir >= 0 ? -Math.PI * 0.45 : Math.PI * 0.55;
    const endAngle = facingDir >= 0 ? Math.PI * 0.45 : Math.PI * 1.45;

    g.fillStyle(0x0a84ff, 0.22);
    g.fillCircle(0, 0, 28);

    g.lineStyle(4, 0x64d2ff, 1);
    g.beginPath();
    g.arc(0, 0, 36, startAngle, endAngle, false);
    g.strokePath();

    g.lineStyle(2.5, 0xffffff, 0.95);
    g.beginPath();
    g.arc(0, 0, 25, startAngle, endAngle, false);
    g.strokePath();

    for (let i = -2; i <= 2; i++) {
      const sparkAngle = (facingDir >= 0 ? 0 : Math.PI) + i * 0.28;
      g.lineBetween(
        Math.cos(sparkAngle) * 18,
        Math.sin(sparkAngle) * 18,
        Math.cos(sparkAngle) * 34,
        Math.sin(sparkAngle) * 34,
      );
    }

    container.add(g);

    this.scene.tweens.add({
      targets: container,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 180,
      onComplete: () => container.destroy(),
    });
  }

  spawnSpecialCastFlash(x, y, colorHex = 0xff3b30, facingDir = 1) {
    const container = this.scene.add.container(x, y).setDepth(28);
    const ring = this.scene.add.circle(0, 0, 22, colorHex, 0.28);
    ring.setStrokeStyle(3, 0xffd60a, 1);

    const wave = this.scene.add.graphics();
    wave.lineStyle(4, colorHex, 0.9);
    const startAngle = facingDir >= 0 ? -Math.PI * 0.38 : Math.PI * 0.62;
    const endAngle = facingDir >= 0 ? Math.PI * 0.38 : Math.PI * 1.38;
    wave.beginPath();
    wave.arc(0, 0, 30, startAngle, endAngle, false);
    wave.strokePath();

    container.add([ring, wave]);

    this.scene.tweens.add({
      targets: ring,
      scaleX: 3.1,
      scaleY: 3.1,
      alpha: 0,
      duration: 260,
    });

    this.scene.tweens.add({
      targets: wave,
      x: facingDir * 44,
      scaleX: 1.6,
      scaleY: 1.6,
      alpha: 0,
      duration: 260,
      onComplete: () => container.destroy(),
    });
  }

  spawnAfterimage(sprite, tintHex = 0xff3b30) {
    if (!sprite || !sprite.active) return;
    const ghost = this.scene.add
      .sprite(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name)
      .setOrigin(sprite.originX, sprite.originY)
      .setScale(sprite.scaleX, sprite.scaleY)
      .setFlipX(sprite.flipX)
      .setTint(tintHex)
      .setAlpha(0.42)
      .setDepth(sprite.depth - 1);

    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 160,
      onComplete: () => ghost.destroy(),
    });
  }

  spawnKnockbackBurst(x, groundY, pushDir = 1, isHeavy = false) {
    const count = isHeavy ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const puff = this.scene.add
        .circle(
          x - pushDir * (i * 10),
          groundY - 5 - (i % 2) * 4,
          6 + (i % 3) * 2.5,
          0xe0d6c8,
          0.5,
        )
        .setDepth(25);

      this.scene.tweens.add({
        targets: puff,
        x: puff.x - pushDir * (18 + i * 8),
        y: puff.y - 12 - Math.random() * 10,
        scaleX: 1.9,
        scaleY: 1.9,
        alpha: 0,
        duration: 230,
        onComplete: () => puff.destroy(),
      });
    }
  }

  spawnDustPuff(x, groundY, count = 4) {
    for (let i = 0; i < count; i++) {
      const offsetX = (i - (count - 1) / 2) * 16;
      const puff = this.scene.add
        .circle(x + offsetX, groundY - 6, 6 + (i % 2) * 3, 0xd8cfc2, 0.44)
        .setDepth(25);

      this.scene.tweens.add({
        targets: puff,
        x: puff.x + offsetX * 1.35,
        y: puff.y - 15 - Math.random() * 9,
        scaleX: 1.75,
        scaleY: 1.75,
        alpha: 0,
        duration: 220,
        onComplete: () => puff.destroy(),
      });
    }
  }

  spawnFloatingPopup(x, y, textValue, color = "#ffd60a") {
    const label = this.scene.add
      .text(x, y, textValue, {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "21px",
        color,
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(35);

    this.scene.tweens.add({
      targets: label,
      y: y - 36,
      alpha: 0,
      duration: 430,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  triggerImpactCameraFeedback(attackState, blocked) {
    if (blocked) {
      this.scene.cameras.main.shake(55, 0.0022);
      return;
    }
    if (attackState === "SPECIAL") {
      this.scene.cameras.main.shake(155, 0.0085);
    } else if (attackState === "KICK") {
      this.scene.cameras.main.shake(95, 0.0048);
    } else {
      this.scene.cameras.main.shake(60, 0.0026);
    }
  }
}
