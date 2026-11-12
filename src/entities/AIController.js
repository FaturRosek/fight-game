import {
  AI_DIFFICULTY_PROFILES,
  FIGHTER_STATES,
  COMBAT_CONFIG,
  ATTACK_SPECS,
} from "../config/gameData.js";

export default class AIController {
  constructor(scene, aiFighter, targetFighter, difficultyName = "Normal") {
    this.scene = scene;
    this.aiFighter = aiFighter;
    this.targetFighter = targetFighter;
    this.setDifficulty(difficultyName);

    this.currentTactic = "IDLE_WAIT";
    this.decisionTimerMs = 0;
    this.tacticDurationMs = 0;
    this.blockTimerMs = 0;
    this.blockLockoutMs = 0;
    this.attackRestTimerMs = 0;
    this.threatReactionTimerMs = 0;
    this.detectedOpponentAttack = false;
    this.lastAttackKey = null;
    this.pendingComboAttack = null;
    this.comboDelayTimerMs = 0;
    this.runTapPhase = 0;
    this.runTapTimerMs = 0;
  }

  setDifficulty(difficultyName) {
    this.difficultyName = AI_DIFFICULTY_PROFILES[difficultyName]
      ? difficultyName
      : "Normal";
    this.profile = AI_DIFFICULTY_PROFILES[this.difficultyName];
  }

  reset() {
    this.currentTactic = "IDLE_WAIT";
    this.decisionTimerMs = 0;
    this.tacticDurationMs = 0;
    this.blockTimerMs = 0;
    this.blockLockoutMs = 0;
    this.attackRestTimerMs = 0;
    this.threatReactionTimerMs = 0;
    this.detectedOpponentAttack = false;
    this.lastAttackKey = null;
    this.pendingComboAttack = null;
    this.comboDelayTimerMs = 0;
    this.runTapPhase = 0;
    this.runTapTimerMs = 0;
  }

  createEmptyInput() {
    return {
      left: false,
      right: false,
      up: false,
      down: false,
      jumpPressed: false,
      punchPressed: false,
      kickPressed: false,
      specialPressed: false,
      blockHeld: false,
    };
  }

  getInputState(deltaMs) {
    const safeDelta = deltaMs > 0 ? Math.min(deltaMs, 50) : 16.67;
    const input = this.createEmptyInput();

    if (!this.aiFighter || !this.targetFighter) return input;
    if (this.aiFighter.health <= 0 || this.targetFighter.health <= 0)
      return input;

    if (this.blockLockoutMs > 0) {
      this.blockLockoutMs = Math.max(0, this.blockLockoutMs - safeDelta);
    }
    if (this.attackRestTimerMs > 0) {
      this.attackRestTimerMs = Math.max(0, this.attackRestTimerMs - safeDelta);
    }

    if (this.aiFighter.state === FIGHTER_STATES.HIT) {
      this.pendingComboAttack = null;
      this.currentTactic = "RECOVER";
      this.decisionTimerMs = Math.min(this.decisionTimerMs, 60);
      return input;
    }

    const dx = this.targetFighter.x - this.aiFighter.x;
    const distance = Math.abs(dx);
    const dirToTarget = dx >= 0 ? 1 : -1;

    this.evaluateIncomingThreat(safeDelta, distance);

    if (this.currentTactic === "BLOCK") {
      this.blockTimerMs -= safeDelta;
      const opponentStillAttacking = Boolean(
        this.targetFighter.activeAttackSpec,
      );
      if (this.blockTimerMs > 0 && (opponentStillAttacking || distance < 150)) {
        input.blockHeld = true;
        return input;
      }
      this.currentTactic = "IDLE_WAIT";
      this.blockLockoutMs = 340;
    }

    if (this.pendingComboAttack && !this.aiFighter.activeAttackSpec) {
      this.comboDelayTimerMs -= safeDelta;
      if (this.comboDelayTimerMs <= 0) {
        const nextAttack = this.pendingComboAttack;
        this.pendingComboAttack = null;
        if (distance <= 135 && this.aiFighter.canTriggerAttack(nextAttack)) {
          this.triggerAttackInput(input, nextAttack);
          this.attackRestTimerMs = this.profile.postAttackPauseMs;
          return input;
        }
      }
    }

    if (this.aiFighter.activeAttackSpec) {
      return input;
    }

    this.decisionTimerMs -= safeDelta;
    this.tacticDurationMs -= safeDelta;

    if (this.decisionTimerMs <= 0 || this.tacticDurationMs <= 0) {
      this.chooseNextTactic(distance, dirToTarget, input);
      const jitter =
        (Math.random() * 0.36 - 0.18) * this.profile.decisionIntervalMs;
      this.decisionTimerMs = Math.max(
        65,
        this.profile.decisionIntervalMs + jitter,
      );
    }

    this.applyMovementTactic(input, distance, dirToTarget, safeDelta);
    return input;
  }

  evaluateIncomingThreat(deltaMs, distance) {
    const oppSpec = this.targetFighter.activeAttackSpec;
    const threatRange = oppSpec
      ? oppSpec.reachX + oppSpec.width * 0.75 + 32
      : 135;

    if (oppSpec && distance <= threatRange) {
      this.threatReactionTimerMs += deltaMs;
      if (
        !this.detectedOpponentAttack &&
        this.threatReactionTimerMs >= this.profile.reactionDelayMs
      ) {
        this.detectedOpponentAttack = true;
        this.respondToThreat(distance);
      }
    } else {
      this.threatReactionTimerMs = 0;
      this.detectedOpponentAttack = false;
    }
  }

  respondToThreat(distance) {
    if (
      this.aiFighter.activeAttackSpec ||
      this.aiFighter.state === FIGHTER_STATES.HIT
    )
      return;

    const roll = Math.random();
    if (this.blockLockoutMs <= 0 && roll < this.profile.blockChanceOnThreat) {
      this.currentTactic = "BLOCK";
      this.blockTimerMs = Math.min(
        this.profile.maxBlockHoldMs,
        190 + Math.random() * 220,
      );
      this.tacticDurationMs = this.blockTimerMs;
      return;
    }

    if (
      roll <
        this.profile.blockChanceOnThreat + this.profile.evadeBackstepChance &&
      distance < 145
    ) {
      this.currentTactic = "RETREAT";
      this.tacticDurationMs = 210 + Math.random() * 140;
    }
  }

  chooseNextTactic(distance, dirToTarget, input) {
    const nearLeftWall = this.aiFighter.x < COMBAT_CONFIG.stageLeftBound + 75;
    const nearRightWall = this.aiFighter.x > COMBAT_CONFIG.stageRightBound - 75;
    const cornered =
      (dirToTarget === 1 && nearLeftWall) ||
      (dirToTarget === -1 && nearRightWall);

    const opponentRecovering =
      Boolean(this.targetFighter.activeAttackSpec) &&
      !this.targetFighter.isHitboxActive &&
      this.targetFighter.attackElapsedMs >
        this.targetFighter.activeAttackSpec.startupMs;

    if (
      opponentRecovering &&
      distance <= 132 &&
      this.attackRestTimerMs <= 0 &&
      Math.random() < this.profile.punishRecoveryChance
    ) {
      this.executeSelectedAttack(input, distance, true);
      return;
    }

    if (distance > this.profile.preferredRangeMax + 95) {
      this.currentTactic =
        this.profile.enableRunApproach && Math.random() < 0.65
          ? "RUN_APPROACH"
          : "APPROACH";
      this.tacticDurationMs = 320 + Math.random() * 220;
      this.runTapPhase = 0;
      this.runTapTimerMs = 0;
      return;
    }

    if (distance > this.profile.preferredRangeMax) {
      if (Math.random() < 0.82) {
        this.currentTactic = "APPROACH";
        this.tacticDurationMs = 220 + Math.random() * 180;
      } else {
        this.currentTactic = "SPACING";
        this.tacticDurationMs = 170;
      }
      return;
    }

    if (distance < this.profile.preferredRangeMin) {
      if (cornered && Math.random() < 0.55 && this.aiFighter.isGrounded) {
        input.jumpPressed = true;
        input.up = true;
        this.currentTactic = "APPROACH";
        this.tacticDurationMs = 360;
        return;
      }

      if (
        this.attackRestTimerMs <= 0 &&
        Math.random() < this.profile.aggressionChance
      ) {
        this.executeSelectedAttack(input, distance, false);
        return;
      }

      if (!cornered && Math.random() < 0.65) {
        this.currentTactic = "RETREAT";
        this.tacticDurationMs = 180 + Math.random() * 140;
      } else {
        this.currentTactic = "BLOCK";
        this.blockTimerMs = 200;
        this.tacticDurationMs = 200;
      }
      return;
    }

    if (
      this.attackRestTimerMs <= 0 &&
      Math.random() < this.profile.aggressionChance
    ) {
      this.executeSelectedAttack(input, distance, false);
      return;
    }

    const spacingRoll = Math.random();
    if (spacingRoll < 0.38 && !cornered) {
      this.currentTactic = "RETREAT";
      this.tacticDurationMs = 160 + Math.random() * 120;
    } else if (spacingRoll < 0.68) {
      this.currentTactic = "APPROACH";
      this.tacticDurationMs = 150 + Math.random() * 120;
    } else if (spacingRoll < 0.82) {
      this.currentTactic = "CROUCH_GUARD";
      this.tacticDurationMs = 150 + Math.random() * 110;
    } else {
      this.currentTactic = "IDLE_WAIT";
      this.tacticDurationMs = 140 + Math.random() * 130;
    }
  }

  executeSelectedAttack(input, distance, isPunish) {
    const canPunch =
      distance <= ATTACK_SPECS.punch.reachX + ATTACK_SPECS.punch.width * 0.55 &&
      this.aiFighter.canTriggerAttack("punch");
    const canKick =
      distance <= ATTACK_SPECS.kick.reachX + ATTACK_SPECS.kick.width * 0.55 &&
      this.aiFighter.canTriggerAttack("kick");
    const canSpecial =
      distance <=
        ATTACK_SPECS.special.reachX + ATTACK_SPECS.special.width * 0.5 &&
      this.aiFighter.canTriggerAttack("special");

    let chosen = null;

    if (
      canSpecial &&
      (isPunish || Math.random() < this.profile.specialUsageChance) &&
      this.lastAttackKey !== "special"
    ) {
      chosen = "special";
    } else if (canPunch && canKick) {
      if (this.lastAttackKey === "punch") {
        chosen = Math.random() < 0.72 ? "kick" : "punch";
      } else if (this.lastAttackKey === "kick") {
        chosen = Math.random() < 0.75 ? "punch" : "kick";
      } else {
        chosen = distance > 102 ? "kick" : "punch";
      }
    } else if (canKick) {
      chosen = "kick";
    } else if (canPunch) {
      chosen = "punch";
    }

    if (!chosen) {
      this.currentTactic = "APPROACH";
      this.tacticDurationMs = 160;
      return;
    }

    this.triggerAttackInput(input, chosen);
    this.lastAttackKey = chosen;
    this.attackRestTimerMs = this.profile.postAttackPauseMs;
    this.currentTactic = "IDLE_WAIT";
    this.tacticDurationMs = 210;

    if (
      chosen === "punch" &&
      Math.random() < this.profile.comboFollowupChance
    ) {
      if (
        Math.random() < this.profile.specialUsageChance &&
        this.aiFighter.cooldowns.special <= 0
      ) {
        this.pendingComboAttack = "special";
      } else {
        this.pendingComboAttack = "kick";
      }
      const totalPunchTime =
        ATTACK_SPECS.punch.startupMs +
        ATTACK_SPECS.punch.activeMs +
        ATTACK_SPECS.punch.recoveryMs;
      this.comboDelayTimerMs = totalPunchTime + 35;
    }
  }

  triggerAttackInput(input, attackKey) {
    if (attackKey === "punch") {
      input.punchPressed = true;
    } else if (attackKey === "kick") {
      input.kickPressed = true;
    } else if (attackKey === "special") {
      input.specialPressed = true;
    }
  }

  applyMovementTactic(input, distance, dirToTarget, deltaMs) {
    if (this.currentTactic === "RUN_APPROACH") {
      if (distance <= this.profile.preferredRangeMax) {
        this.currentTactic = "IDLE_WAIT";
        return;
      }
      this.runTapTimerMs += deltaMs;
      if (this.runTapPhase === 0) {
        this.setMoveDirection(input, dirToTarget);
        if (this.runTapTimerMs >= 45) {
          this.runTapPhase = 1;
          this.runTapTimerMs = 0;
        }
      } else if (this.runTapPhase === 1) {
        if (this.runTapTimerMs >= 40) {
          this.runTapPhase = 2;
          this.runTapTimerMs = 0;
        }
      } else {
        this.setMoveDirection(input, dirToTarget);
      }
      return;
    }

    if (this.currentTactic === "APPROACH") {
      if (distance > COMBAT_CONFIG.minBodyDistance + 10) {
        this.setMoveDirection(input, dirToTarget);
      }
      return;
    }

    if (this.currentTactic === "RETREAT") {
      const retreatDir = -dirToTarget;
      const hitLeftEdge =
        retreatDir === -1 &&
        this.aiFighter.x <= COMBAT_CONFIG.stageLeftBound + 45;
      const hitRightEdge =
        retreatDir === 1 &&
        this.aiFighter.x >= COMBAT_CONFIG.stageRightBound - 45;
      if (!hitLeftEdge && !hitRightEdge) {
        this.setMoveDirection(input, retreatDir);
      } else {
        this.currentTactic = "IDLE_WAIT";
      }
      return;
    }

    if (this.currentTactic === "CROUCH_GUARD") {
      input.down = true;
    }
  }

  setMoveDirection(input, dir) {
    if (dir > 0) {
      input.right = true;
      input.left = false;
    } else if (dir < 0) {
      input.left = true;
      input.right = false;
    }
  }
}
