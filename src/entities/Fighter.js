import Phaser from "phaser";
import {
  FIGHTER_STATES,
  COMBAT_CONFIG,
  ATTACK_SPECS,
} from "../config/gameData.js";
import { soundManager } from "../systems/SoundManager.js";

export default class Fighter {
  constructor(scene, config) {
    this.scene = scene;
    this.playerNumber = config.playerNumber;
    this.characterData = config.characterData;
    this.groundY = config.groundY;
    this.startX = config.x;
    this.defaultFacing = config.facing || 1;
    this.baseScale = 1.05;

    this.x = config.x;
    this.y = config.groundY;
    this.velocityX = 0;
    this.velocityY = 0;
    this.knockbackVelocity = 0;

    this.facing = this.defaultFacing;
    this.opponentX = null;
    this.maxHealth = COMBAT_CONFIG.maxHealth;
    this.health = this.maxHealth;
    this.state = FIGHTER_STATES.IDLE;

    this.isGrounded = true;
    this.isRunning = false;
    this.lastMoveDir = 0;
    this.lastMoveTapTime = 0;
    this.wasLeftHeld = false;
    this.wasRightHeld = false;
    this.skidParticleTimerMs = 0;
    this.afterimageTimerMs = 0;

    this.activeAttackSpec = null;
    this.attackElapsedMs = 0;
    this.hasHitCurrentAttack = false;
    this.stunTimerMs = 0;
    this.hitStopMs = 0;

    this.cooldowns = {
      punch: 0,
      kick: 0,
      special: 0,
    };

    this.shadow = scene.add
      .ellipse(this.x, this.groundY - 6, 130, 24, 0x000000, 0.62)
      .setDepth(10);
    this.sprite = scene.add
      .sprite(this.x, this.y, this.characterData.textureKey, 0)
      .setOrigin(0.5, 1)
      .setScale(this.baseScale)
      .setDepth(20);

    this.sprite.on("animationcomplete", () => {
      if (
        !this.activeAttackSpec &&
        this.state !== FIGHTER_STATES.HIT &&
        this.state !== FIGHTER_STATES.BLOCK &&
        this.state !== FIGHTER_STATES.CROUCH &&
        this.isGrounded &&
        this.velocityX === 0
      ) {
        this.playStateAnimation(FIGHTER_STATES.IDLE, true);
      }
    });

    this.hurtbox = new Phaser.Geom.Rectangle(0, 0, 74, 210);
    this.hitbox = new Phaser.Geom.Rectangle(0, 0, 0, 0);
    this.isHitboxActive = false;

    this.syncVisuals();
    this.playStateAnimation(FIGHTER_STATES.IDLE, true);
  }

  resetFighter() {
    this.x = this.startX;
    this.y = this.groundY;
    this.velocityX = 0;
    this.velocityY = 0;
    this.knockbackVelocity = 0;
    this.facing = this.defaultFacing;
    this.health = this.maxHealth;
    this.isGrounded = true;
    this.isRunning = false;
    this.activeAttackSpec = null;
    this.attackElapsedMs = 0;
    this.hasHitCurrentAttack = false;
    this.stunTimerMs = 0;
    this.hitStopMs = 0;
    this.cooldowns.punch = 0;
    this.cooldowns.kick = 0;
    this.cooldowns.special = 0;
    this.sprite.clearTint();
    this.sprite.setAngle(0);
    this.sprite.setScale(this.baseScale);
    this.setState(FIGHTER_STATES.IDLE, true);
    this.updateBounds();
    this.syncVisuals();
  }

  applyAuthoritativeNetState(netData, deltaMs = 16.67) {
    if (!netData) return;
    const lerpFactor = Math.min(1, (deltaMs / 1000) * 22);

    if (Math.abs(this.x - netData.x) > 120) {
      this.x = netData.x;
    } else {
      this.x = Phaser.Math.Linear(this.x, netData.x, lerpFactor);
    }

    if (Math.abs(this.y - netData.y) > 120) {
      this.y = netData.y;
    } else {
      this.y = Phaser.Math.Linear(this.y, netData.y, lerpFactor);
    }

    this.isGrounded = Math.abs(this.y - this.groundY) < 4;
    this.facing = netData.facing >= 0 ? 1 : -1;
    this.health = netData.hp;
    this.cooldowns.special = netData.spCd || 0;

    if (netData.state && this.state !== netData.state) {
      if (netData.state === FIGHTER_STATES.HIT) {
        this.triggerTransitionPulse(1.09, 0.92, 110);
        this.sprite.setTint(0xff453a);
        this.scene.time.delayedCall(140, () => {
          if (this.sprite && this.sprite.active) this.sprite.clearTint();
        });
      }
      this.setState(netData.state, true);
    }

    this.updateBounds();
    if (netData.hb) {
      this.isHitboxActive = true;
      this.hitbox.setTo(netData.hb.x, netData.hb.y, netData.hb.width, netData.hb.height);
    } else {
      this.isHitboxActive = false;
      this.hitbox.setTo(0, 0, 0, 0);
    }

    this.syncVisuals();
  }

  setOpponentPosition(opponentX) {
    this.opponentX = opponentX;
    if (!this.activeAttackSpec && this.state !== FIGHTER_STATES.HIT) {
      this.faceTowardsOpponent();
    }
  }

  faceTowardsOpponent() {
    if (this.opponentX === null || this.opponentX === undefined) return;
    const diff = this.opponentX - this.x;
    if (Math.abs(diff) > 2) {
      this.facing = diff >= 0 ? 1 : -1;
    }
  }

  applyHitStop(durationMs = 55) {
    this.hitStopMs = Math.max(this.hitStopMs, durationMs);
  }

  triggerTransitionPulse(scaleXFactor, scaleYFactor, durationMs = 95) {
    if (!this.sprite || !this.sprite.active) return;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(
      this.baseScale * scaleXFactor,
      this.baseScale * scaleYFactor,
    );
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.baseScale,
      scaleY: this.baseScale,
      duration: durationMs,
      ease: "Quad.easeOut",
    });
  }

  enterRoundEndPose(endState) {
    this.velocityX = 0;
    this.isRunning = false;
    this.activeAttackSpec = null;
    this.isHitboxActive = false;
    this.hasHitCurrentAttack = false;
    this.attackElapsedMs = 0;
    this.stunTimerMs = 0;
    this.hitStopMs = 0;
    this.sprite.clearTint();

    if (endState === FIGHTER_STATES.DEFEAT) {
      this.isGrounded = false;
      this.velocityY = -420;
      this.knockbackVelocity = -this.facing * 360;
      if (this.scene.effectsManager) {
        this.scene.effectsManager.spawnKnockbackBurst(this.x, this.groundY, -this.facing, true);
      }
    }

    this.setState(endState, true);
  }

  update(deltaMs, inputState) {
    const safeDeltaMs = deltaMs > 0 ? Math.min(deltaMs, 50) : 16.67;

    Object.keys(this.cooldowns).forEach((key) => {
      if (this.cooldowns[key] > 0) {
        this.cooldowns[key] = Math.max(0, this.cooldowns[key] - safeDeltaMs);
      }
    });

    if (this.hitStopMs > 0) {
      this.hitStopMs = Math.max(0, this.hitStopMs - safeDeltaMs);
      this.updateBounds();
      this.syncVisuals();
      return;
    }

    const dt = safeDeltaMs / 1000;

    if (
      this.state === FIGHTER_STATES.VICTORY ||
      this.state === FIGHTER_STATES.DEFEAT
    ) {
      this.velocityX = 0;
      this.applyPhysics(dt, safeDeltaMs);
      this.updateBounds();
      this.syncVisuals();
      return;
    }

    if (this.stunTimerMs > 0) {
      this.stunTimerMs = Math.max(0, this.stunTimerMs - safeDeltaMs);
    }

    if (this.state === FIGHTER_STATES.HIT && this.stunTimerMs <= 0) {
      this.activeAttackSpec = null;
      this.isHitboxActive = false;
      this.hasHitCurrentAttack = false;
      this.faceTowardsOpponent();
      this.setState(this.isGrounded ? FIGHTER_STATES.IDLE : FIGHTER_STATES.JUMP, true);
    }

    if (this.activeAttackSpec) {
      this.updateActiveAttack(safeDeltaMs);
    }

    if (this.state !== FIGHTER_STATES.HIT && !this.activeAttackSpec) {
      this.faceTowardsOpponent();
      this.handlePlayerInput(inputState);
    }

    this.applyPhysics(dt, safeDeltaMs);
    this.updateBounds();
    this.syncVisuals();
  }

  detectRunDoubleTap(input) {
    const now = this.scene.time.now;
    const leftJustPressed = input.left && !this.wasLeftHeld;
    const rightJustPressed = input.right && !this.wasRightHeld;

    this.wasLeftHeld = Boolean(input.left);
    this.wasRightHeld = Boolean(input.right);

    if (leftJustPressed) {
      if (
        this.lastMoveDir === -1 &&
        now - this.lastMoveTapTime <= COMBAT_CONFIG.doubleTapWindowMs
      ) {
        this.isRunning = true;
        if (this.scene.effectsManager && this.isGrounded) {
          this.scene.effectsManager.spawnDustPuff(this.x, this.groundY, 3);
        }
      }
      this.lastMoveDir = -1;
      this.lastMoveTapTime = now;
    } else if (rightJustPressed) {
      if (
        this.lastMoveDir === 1 &&
        now - this.lastMoveTapTime <= COMBAT_CONFIG.doubleTapWindowMs
      ) {
        this.isRunning = true;
        if (this.scene.effectsManager && this.isGrounded) {
          this.scene.effectsManager.spawnDustPuff(this.x, this.groundY, 3);
        }
      }
      this.lastMoveDir = 1;
      this.lastMoveTapTime = now;
    }

    if (!input.left && !input.right) {
      this.isRunning = false;
    }
  }

  handlePlayerInput(input) {
    if (!input) {
      this.velocityX = 0;
      this.isRunning = false;
      return;
    }

    this.detectRunDoubleTap(input);
    const moveDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    if (input.specialPressed && this.canTriggerAttack("special")) {
      if (input.consumeAction) input.consumeAction("special");
      this.startAttack("special");
      return;
    }

    if (input.punchPressed && this.canTriggerAttack("punch")) {
      if (input.consumeAction) input.consumeAction("punch");
      this.startAttack("punch");
      return;
    }

    if (input.kickPressed && this.canTriggerAttack("kick")) {
      if (input.consumeAction) input.consumeAction("kick");
      this.startAttack("kick");
      return;
    }

    if (input.blockHeld && this.isGrounded) {
      this.velocityX = 0;
      this.isRunning = false;
      this.faceTowardsOpponent();
      this.setState(FIGHTER_STATES.BLOCK);
      return;
    }

    const activeSpeed = this.isRunning
      ? COMBAT_CONFIG.runSpeed
      : COMBAT_CONFIG.walkSpeed;

    if (input.jumpPressed && this.isGrounded) {
      if (input.consumeAction) input.consumeAction("jump");
      this.isGrounded = false;
      this.velocityY = COMBAT_CONFIG.jumpVelocity;
      this.velocityX = moveDir * activeSpeed * 0.9;
      this.setState(FIGHTER_STATES.JUMP, true);
      this.triggerTransitionPulse(0.92, 1.09, 120);
      soundManager.playJump();
      if (this.scene.effectsManager) {
        this.scene.effectsManager.spawnDustPuff(this.x, this.groundY, 4);
      }
      return;
    }

    if (!this.isGrounded) {
      this.velocityX = moveDir * activeSpeed * 0.85;
      return;
    }

    if (input.down && moveDir === 0) {
      this.velocityX = 0;
      this.isRunning = false;
      if (this.state !== FIGHTER_STATES.CROUCH) {
        this.triggerTransitionPulse(1.06, 0.92, 85);
      }
      this.setState(FIGHTER_STATES.CROUCH);
      return;
    }

    if (moveDir !== 0) {
      this.velocityX = moveDir * activeSpeed;
      this.setState(this.isRunning ? FIGHTER_STATES.RUN : FIGHTER_STATES.WALK);
    } else {
      this.velocityX = 0;
      this.setState(FIGHTER_STATES.IDLE);
    }
  }

  canTriggerAttack(attackKey) {
    if (this.cooldowns[attackKey] > 0) return false;
    if (
      this.state === FIGHTER_STATES.HIT ||
      this.state === FIGHTER_STATES.BLOCK
    )
      return false;
    if (this.activeAttackSpec) return false;
    return true;
  }

  startAttack(attackKey) {
    const spec = ATTACK_SPECS[attackKey];
    if (!spec) return;

    this.faceTowardsOpponent();

    this.activeAttackSpec = spec;
    this.attackElapsedMs = 0;
    this.hasHitCurrentAttack = false;
    this.isHitboxActive = false;
    this.afterimageTimerMs = 0;
    this.cooldowns[attackKey] = spec.cooldownMs;

    if (this.isGrounded) {
      this.velocityX = 0;
    }

    this.triggerTransitionPulse(1.05, 0.97, 80);
    soundManager.playSwing(attackKey);

    if (attackKey === "special" && this.scene.effectsManager) {
      this.scene.effectsManager.spawnSpecialCastFlash(
        this.x + this.facing * 32,
        this.y - 135,
        this.characterData.color,
        this.facing,
      );
    }

    this.setState(FIGHTER_STATES[spec.state], true);
  }

  updateActiveAttack(deltaMs) {
    const spec = this.activeAttackSpec;
    this.attackElapsedMs += deltaMs;

    const activeStart = spec.startupMs;
    const activeEnd = spec.startupMs + spec.activeMs;
    const totalDuration = activeEnd + spec.recoveryMs;

    const inTimeWindow = this.attackElapsedMs >= activeStart && this.attackElapsedMs <= activeEnd;
    this.isHitboxActive = !this.hasHitCurrentAttack && inTimeWindow;

    if (spec.state === 'SPECIAL' && inTimeWindow && this.scene.effectsManager) {
      this.afterimageTimerMs += deltaMs;
      if (this.afterimageTimerMs >= 55) {
        this.afterimageTimerMs = 0;
        this.scene.effectsManager.spawnAfterimage(this.sprite, this.characterData.color);
      }
    }

    if (this.attackElapsedMs >= totalDuration) {
      this.activeAttackSpec = null;
      this.isHitboxActive = false;
      this.hasHitCurrentAttack = false;
      this.attackElapsedMs = 0;
      this.faceTowardsOpponent();
      this.setState(this.isGrounded ? FIGHTER_STATES.IDLE : FIGHTER_STATES.JUMP, true);
    }
  }

  applyPhysics(dt, deltaMs = 16.67) {
    if (Math.abs(this.knockbackVelocity) > 5) {
      this.x += this.knockbackVelocity * dt;
      this.knockbackVelocity *= Math.pow(0.035, dt);

      if (
        this.isGrounded &&
        Math.abs(this.knockbackVelocity) > 130 &&
        this.scene.effectsManager
      ) {
        this.skidParticleTimerMs += deltaMs;
        if (this.skidParticleTimerMs >= 65) {
          this.skidParticleTimerMs = 0;
          this.scene.effectsManager.spawnDustPuff(this.x, this.groundY, 1);
        }
      }
    } else {
      this.knockbackVelocity = 0;
    }

    if (this.state !== FIGHTER_STATES.HIT && !this.activeAttackSpec) {
      this.x += this.velocityX * dt;
    } else if (
      this.activeAttackSpec &&
      this.attackElapsedMs < this.activeAttackSpec.startupMs
    ) {
      this.x += this.facing * 48 * dt;
    }

    if (!this.isGrounded) {
      this.velocityY += COMBAT_CONFIG.gravity * dt;
      this.y += this.velocityY * dt;

      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.velocityY = 0;
        this.isGrounded = true;
        this.triggerTransitionPulse(1.08, 0.91, 105);
        soundManager.playLand();
        if (this.scene.effectsManager) {
          this.scene.effectsManager.spawnDustPuff(this.x, this.groundY, 3);
        }
        if (!this.activeAttackSpec && this.state !== FIGHTER_STATES.HIT) {
          this.setState(FIGHTER_STATES.IDLE, true);
        }
      }
    } else {
      this.y = this.groundY;
    }

    this.clampToArena();
  }

  clampToArena() {
    if (this.x < COMBAT_CONFIG.stageLeftBound) {
      this.x = COMBAT_CONFIG.stageLeftBound;
    } else if (this.x > COMBAT_CONFIG.stageRightBound) {
      this.x = COMBAT_CONFIG.stageRightBound;
    }
  }

  receiveAttack(attackSpec, attackerDirection) {
    if (!attackSpec) {
      return { blocked: false, damage: 0 };
    }

    const incomingDir = attackerDirection >= 0 ? 1 : -1;
    this.facing = -incomingDir;
    const isBlocking =
      this.state === FIGHTER_STATES.BLOCK &&
      this.isGrounded &&
      !this.activeAttackSpec;

    const finalDamage = isBlocking
      ? Math.max(
          1,
          Math.round(attackSpec.damage * COMBAT_CONFIG.blockDamageMultiplier),
        )
      : attackSpec.damage;

    this.health = Math.max(0, this.health - finalDamage);

    const pushback = isBlocking
      ? attackSpec.knockback * 0.42
      : attackSpec.knockback;
    this.knockbackVelocity = incomingDir * pushback;

    this.activeAttackSpec = null;
    this.isHitboxActive = false;
    this.hasHitCurrentAttack = false;
    this.attackElapsedMs = 0;

    if (isBlocking) {
      this.stunTimerMs = attackSpec.blockStunMs;
      this.triggerTransitionPulse(0.95, 1.03, 90);
      this.sprite.setTint(0x64d2ff);
      this.scene.time.delayedCall(120, () => {
        if (this.sprite && this.sprite.active) this.sprite.clearTint();
      });
      return { blocked: true, damage: finalDamage };
    }

    this.stunTimerMs = attackSpec.hitStunMs;
    this.setState(FIGHTER_STATES.HIT, true);
    this.triggerTransitionPulse(1.09, 0.92, 120);

    if (this.scene.effectsManager) {
      const isHeavyHit =
        attackSpec.state === "KICK" || attackSpec.state === "SPECIAL";
      this.scene.effectsManager.spawnKnockbackBurst(
        this.x,
        this.groundY,
        incomingDir,
        isHeavyHit,
      );
    }

    this.sprite.setTint(0xff453a);
    this.scene.time.delayedCall(150, () => {
      if (this.sprite && this.sprite.active) this.sprite.clearTint();
    });

    return { blocked: false, damage: finalDamage };
  }

  updateBounds() {
    const isCrouching = this.state === FIGHTER_STATES.CROUCH;
    const hurtW = 74;
    const hurtH = isCrouching ? 145 : 215;

    this.hurtbox.setTo(this.x - hurtW / 2, this.y - hurtH - 12, hurtW, hurtH);

    if (this.isHitboxActive && this.activeAttackSpec) {
      const spec = this.activeAttackSpec;
      const forwardCenterX = this.x + this.facing * spec.reachX;
      const hx = forwardCenterX - spec.width / 2;
      const hy = this.y + spec.offsetY - spec.height / 2;
      this.hitbox.setTo(hx, hy, spec.width, spec.height);
    } else {
      this.hitbox.setTo(0, 0, 0, 0);
    }
  }

  setFacing(direction) {
    if (this.activeAttackSpec || this.state === FIGHTER_STATES.HIT) return;
    this.facing = direction >= 0 ? 1 : -1;
  }

  setState(nextState, forceAnim = false) {
    if (this.state === nextState && !forceAnim) return;
    this.state = nextState;
    this.playStateAnimation(nextState, forceAnim);
  }

  playStateAnimation(stateName, forceRestart = false) {
    const animMap = {
      [FIGHTER_STATES.IDLE]: 'idle',
      [FIGHTER_STATES.WALK]: 'walk',
      [FIGHTER_STATES.RUN]: 'run',
      [FIGHTER_STATES.JUMP]: 'jump',
      [FIGHTER_STATES.CROUCH]: 'crouch',
      [FIGHTER_STATES.PUNCH]: 'punch',
      [FIGHTER_STATES.KICK]: 'kick',
      [FIGHTER_STATES.BLOCK]: 'block',
      [FIGHTER_STATES.HIT]: 'hit',
      [FIGHTER_STATES.SPECIAL]: 'special',
      [FIGHTER_STATES.VICTORY]: 'victory',
      [FIGHTER_STATES.DEFEAT]: 'defeat'
    };

    const animSuffix = animMap[stateName] || 'idle';
    const animKey = `${this.characterData.id}_${animSuffix}`;

    if (this.scene.anims.exists(animKey)) {
      const currentKey = this.sprite.anims.currentAnim ? this.sprite.anims.currentAnim.key : '';
      if (forceRestart || currentKey !== animKey) {
        this.sprite.play(animKey, true);
      }
    }
  }

  syncVisuals() {
    this.sprite.setPosition(this.x, this.y);
    this.sprite.setFlipX(this.facing === -1);

    const heightOffset = Math.max(0, this.groundY - this.y);
    const shadowScale = Math.max(0.45, 1 - heightOffset / 320);
    this.shadow.setPosition(this.x, this.groundY - 8);
    if (this.state === FIGHTER_STATES.DEFEAT && this.isGrounded) {
      this.shadow.setScale(1.45, 0.85);
    } else {
      this.shadow.setScale(shadowScale);
    }
  }
}
