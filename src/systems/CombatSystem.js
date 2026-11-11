import Phaser from "phaser";
import { COMBAT_CONFIG } from "../config/gameData.js";

export default class CombatSystem {
  constructor(scene, fighter1, fighter2, onHitCallback) {
    this.scene = scene;
    this.fighter1 = fighter1;
    this.fighter2 = fighter2;
    this.onHitCallback = onHitCallback;
  }

  update() {
    this.resolveFighterPositioning();
    this.updateFacingDirections();
    this.evaluateHitDetection();
  }

  resolveFighterPositioning() {
    const f1 = this.fighter1;
    const f2 = this.fighter2;

    const verticalGap = Math.abs(f1.y - f2.y);
    if (verticalGap > 120) return;

    const dx = f2.x - f1.x;
    const dist = Math.abs(dx);
    const minDist = COMBAT_CONFIG.minBodyDistance;

    if (dist < minDist) {
      const overlap = (minDist - dist) / 2;
      const pushDir = dx >= 0 ? 1 : -1;

      f1.x -= pushDir * overlap;
      f2.x += pushDir * overlap;

      f1.clampToArena();
      f2.clampToArena();

      const postDx = f2.x - f1.x;
      if (Math.abs(postDx) < minDist) {
        if (f1.x <= COMBAT_CONFIG.stageLeftBound + 2) {
          f2.x = f1.x + minDist;
        } else if (f2.x >= COMBAT_CONFIG.stageRightBound - 2) {
          f1.x = f2.x - minDist;
        } else if (f2.x <= COMBAT_CONFIG.stageLeftBound + 2) {
          f1.x = f2.x + minDist;
        } else if (f2.x >= COMBAT_CONFIG.stageRightBound - 2) {
          f2.x = f1.x - minDist;
        }
      }

      f1.updateBounds();
      f2.updateBounds();
      f1.syncVisuals();
      f2.syncVisuals();
    }
  }

  updateFacingDirections() {
    this.fighter1.setOpponentPosition(this.fighter2.x);
    this.fighter2.setOpponentPosition(this.fighter1.x);
  }

  evaluateHitDetection() {
    const f1HitsF2 = this.checkAttackConnection(this.fighter1, this.fighter2);
    const f2HitsF1 = this.checkAttackConnection(this.fighter2, this.fighter1);

    if (f1HitsF2 && f2HitsF1) {
      this.applySimultaneousHits(this.fighter1, this.fighter2);
      return;
    }

    if (f1HitsF2) {
      this.applySingleHit(this.fighter1, this.fighter2);
    } else if (f2HitsF1) {
      this.applySingleHit(this.fighter2, this.fighter1);
    }
  }

  checkAttackConnection(attacker, defender) {
    if (
      !attacker.isHitboxActive ||
      attacker.hasHitCurrentAttack ||
      !attacker.activeAttackSpec
    ) {
      return false;
    }
    if (attacker.hitbox.width <= 0 || attacker.hitbox.height <= 0) {
      return false;
    }
    return Phaser.Geom.Intersects.RectangleToRectangle(
      attacker.hitbox,
      defender.hurtbox,
    );
  }

  applySimultaneousHits(f1, f2) {
    const spec1 = { ...f1.activeAttackSpec };
    const spec2 = { ...f2.activeAttackSpec };
    const dir1 = f1.facing;
    const dir2 = f2.facing;
    const impactY1 = f1.hitbox.centerY;
    const impactY2 = f2.hitbox.centerY;

    f1.hasHitCurrentAttack = true;
    f1.isHitboxActive = false;
    f2.hasHitCurrentAttack = true;
    f2.isHitboxActive = false;

    const res2 = f2.receiveAttack(spec1, dir1);
    const res1 = f1.receiveAttack(spec2, dir2);

    const stop1 =
      spec1.state === "SPECIAL" ? 65 : spec1.state === "KICK" ? 50 : 40;
    const stop2 =
      spec2.state === "SPECIAL" ? 65 : spec2.state === "KICK" ? 50 : 40;
    const sharedStop = Math.max(stop1, stop2);

    f1.applyHitStop(sharedStop);
    f2.applyHitStop(sharedStop);

    if (this.onHitCallback) {
      this.onHitCallback({
        attacker: f1,
        defender: f2,
        attackSpec: spec1,
        blocked: res2.blocked,
        damage: res2.damage,
        impactX: f2.x - dir1 * 24,
        impactY: impactY1,
      });

      this.onHitCallback({
        attacker: f2,
        defender: f1,
        attackSpec: spec2,
        blocked: res1.blocked,
        damage: res1.damage,
        impactX: f1.x - dir2 * 24,
        impactY: impactY2,
      });
    }
  }

  applySingleHit(attacker, defender) {
    if (!attacker.activeAttackSpec) return;

    const spec = { ...attacker.activeAttackSpec };
    const attackerDir = attacker.facing;
    const impactY = attacker.hitbox.centerY;

    attacker.hasHitCurrentAttack = true;
    attacker.isHitboxActive = false;

    const result = defender.receiveAttack(spec, attackerDir);

    const hitStopDuration =
      spec.state === "SPECIAL" ? 70 : spec.state === "KICK" ? 52 : 40;
    attacker.applyHitStop(hitStopDuration);
    defender.applyHitStop(hitStopDuration);

    const impactX = defender.x - attackerDir * 24;

    if (this.onHitCallback) {
      this.onHitCallback({
        attacker,
        defender,
        attackSpec: spec,
        blocked: result.blocked,
        damage: result.damage,
        impactX,
        impactY,
      });
    }
  }
}
