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

    this.shadow = scene.add.ellipse(
      this.x,
      this.groundY - 6,
      130,
      24,
      0x000000,
      0.62,
    );
    this.sprite = scene.add
      .sprite(this.x, this.y, this.characterData.textureKey, 0)
      .setOrigin(0.5, 1)
      .setScale(1.05);

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
    this.activeAttackSpec = null;
    this.attackElapsedMs = 0;
    this.hasHitCurrentAttack = false;
    this.stunTimerMs = 0;
    this.hitStopMs = 0;
    this.cooldowns.punch = 0;
    this.cooldowns.kick = 0;
    this.cooldowns.special = 0;
    this.sprite.clearTint();
    this.setState(FIGHTER_STATES.IDLE, true);
    this.updateBounds();
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

    if (this.stunTimerMs > 0) {
      this.stunTimerMs = Math.max(0, this.stunTimerMs - safeDeltaMs);
    }

    if (this.state === FIGHTER_STATES.HIT && this.stunTimerMs <= 0) {
      this.activeAttackSpec = null;
      this.isHitboxActive = false;
      this.hasHitCurrentAttack = false;
      this.faceTowardsOpponent();
      this.setState(
        this.isGrounded ? FIGHTER_STATES.IDLE : FIGHTER_STATES.JUMP,
        true,
      );
    }

    if (this.activeAttackSpec) {
      this.updateActiveAttack(safeDeltaMs);
    }

    if (this.state !== FIGHTER_STATES.HIT && !this.activeAttackSpec) {
      this.faceTowardsOpponent();
      this.handlePlayerInput(inputState);
    }

    this.applyPhysics(dt);
    this.updateBounds();
    this.syncVisuals();
  }

  handlePlayerInput(input) {
    if (!input) {
      this.velocityX = 0;
      return;
    }

    const moveDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    if (input.specialPressed && this.canTriggerAttack("special")) {
      this.startAttack("special");
      return;
    }

    if (input.punchPressed && this.canTriggerAttack("punch")) {
      this.startAttack("punch");
      return;
    }

    if (input.kickPressed && this.canTriggerAttack("kick")) {
      this.startAttack("kick");
      return;
    }

    if (input.blockHeld && this.isGrounded) {
      this.velocityX = 0;
      this.faceTowardsOpponent();
      this.setState(FIGHTER_STATES.BLOCK);
      return;
    }

    if (input.jumpPressed && this.isGrounded) {
      this.isGrounded = false;
      this.velocityY = COMBAT_CONFIG.jumpVelocity;
      this.velocityX = moveDir * COMBAT_CONFIG.walkSpeed * 0.9;
      this.setState(FIGHTER_STATES.JUMP, true);
      soundManager.playJump();
      if (this.scene.effectsManager) {
        this.scene.effectsManager.spawnDustPuff(this.x, this.groundY, 4);
      }
      return;
    }

    if (!this.isGrounded) {
      this.velocityX = moveDir * COMBAT_CONFIG.walkSpeed * 0.85;
      return;
    }

    if (input.down && moveDir === 0) {
      this.velocityX = 0;
      this.setState(FIGHTER_STATES.CROUCH);
      return;
    }

    if (moveDir !== 0) {
      this.velocityX = moveDir * COMBAT_CONFIG.walkSpeed;
      this.setState(FIGHTER_STATES.WALK);
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
    this.cooldowns[attackKey] = spec.cooldownMs;

    if (this.isGrounded) {
      this.velocityX = 0;
    }

    soundManager.playSwing(attackKey);
    if (attackKey === "special" && this.scene.effectsManager) {
      this.scene.effectsManager.spawnSpecialCastFlash(
        this.x + this.facing * 28,
        this.y - 135,
        this.characterData.color,
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

    const currentAnimFrame = this.sprite.anims?.currentFrame?.index ?? 1;
    const inTimeWindow =
      this.attackElapsedMs >= activeStart && this.attackElapsedMs <= activeEnd;
    const inStrikeFrame =
      currentAnimFrame === 2 || currentAnimFrame === 3 || inTimeWindow;

    this.isHitboxActive =
      !this.hasHitCurrentAttack && inTimeWindow && inStrikeFrame;

    if (this.attackElapsedMs >= totalDuration) {
      this.activeAttackSpec = null;
      this.isHitboxActive = false;
      this.hasHitCurrentAttack = false;
      this.faceTowardsOpponent();
      this.setState(
        this.isGrounded ? FIGHTER_STATES.IDLE : FIGHTER_STATES.JUMP,
        true,
      );
    }
  }

  applyPhysics(dt) {
    if (Math.abs(this.knockbackVelocity) > 5) {
      this.x += this.knockbackVelocity * dt;
      this.knockbackVelocity *= Math.pow(0.035, dt);
    } else {
      this.knockbackVelocity = 0;
    }

    if (this.state !== FIGHTER_STATES.HIT && !this.activeAttackSpec) {
      this.x += this.velocityX * dt;
    } else if (
      this.activeAttackSpec &&
      this.attackElapsedMs < this.activeAttackSpec.startupMs
    ) {
      this.x += this.facing * 45 * dt;
    }

    if (!this.isGrounded) {
      this.velocityY += COMBAT_CONFIG.gravity * dt;
      this.y += this.velocityY * dt;

      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.velocityY = 0;
        this.isGrounded = true;
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
      this.sprite.setTint(0x64d2ff);
      this.scene.time.delayedCall(120, () => {
        if (this.sprite && this.sprite.active) this.sprite.clearTint();
      });
      return { blocked: true, damage: finalDamage };
    }

    this.stunTimerMs = attackSpec.hitStunMs;
    this.setState(FIGHTER_STATES.HIT, true);

    if (this.scene.effectsManager) {
      this.scene.effectsManager.spawnDustPuff(this.x, this.groundY, 2);
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
      [FIGHTER_STATES.IDLE]: "idle",
      [FIGHTER_STATES.WALK]: "walk",
      [FIGHTER_STATES.JUMP]: "jump",
      [FIGHTER_STATES.CROUCH]: "crouch",
      [FIGHTER_STATES.PUNCH]: "punch",
      [FIGHTER_STATES.KICK]: "kick",
      [FIGHTER_STATES.BLOCK]: "block",
      [FIGHTER_STATES.HIT]: "hit",
      [FIGHTER_STATES.SPECIAL]: "special",
    };

    const animSuffix = animMap[stateName] || "idle";
    const animKey = `${this.characterData.id}_${animSuffix}`;

    if (this.scene.anims.exists(animKey)) {
      const currentKey = this.sprite.anims.currentAnim
        ? this.sprite.anims.currentAnim.key
        : "";
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
    this.shadow.setScale(shadowScale);
  }
}
