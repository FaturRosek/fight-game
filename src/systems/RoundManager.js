import { MATCH_CONFIG, FIGHTER_STATES } from "../config/gameData.js";
import { soundManager } from "./SoundManager.js";

export const ROUND_PHASES = {
  INTRO: "INTRO",
  FIGHTING: "FIGHTING",
  ROUND_OVER: "ROUND_OVER",
  MATCH_OVER: "MATCH_OVER",
};

export default class RoundManager {
  constructor(scene, config) {
    this.scene = scene;
    this.fighter1 = config.fighter1;
    this.fighter2 = config.fighter2;
    this.roundsToWin = config.roundsToWin || MATCH_CONFIG.roundsToWin;
    this.roundDurationSeconds =
      config.roundDurationSeconds || MATCH_CONFIG.roundDurationSeconds;

    this.onBannerUpdate = config.onBannerUpdate || null;
    this.onMatchEnd = config.onMatchEnd || null;
    this.onRoundReset = config.onRoundReset || null;

    this.currentRound = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.remainingTimeMs = this.roundDurationSeconds * 1000;
    this.phase = ROUND_PHASES.INTRO;
    this.activeTransitionEvent = null;
    this.introSubEvent = null;
  }

  startMatch() {
    this.clearTimers();
    this.currentRound = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.startRound();
  }

  startRound() {
    this.clearTimers();
    this.phase = ROUND_PHASES.INTRO;
    this.remainingTimeMs = this.roundDurationSeconds * 1000;

    this.fighter1.resetFighter();
    this.fighter2.resetFighter();

    if (this.onRoundReset) {
      this.onRoundReset(this.currentRound);
    }

    if (this.onBannerUpdate) {
      this.onBannerUpdate(
        `ROUND ${this.currentRound}`,
        "GET READY",
        "#ffd60a",
        true,
      );
    }

    this.introSubEvent = this.scene.time.delayedCall(950, () => {
      if (this.phase !== ROUND_PHASES.INTRO) return;
      soundManager.playRoundStart();
      if (this.onBannerUpdate) {
        this.onBannerUpdate(
          "FIGHT!",
          `FIRST TO ${this.roundsToWin} WINS`,
          "#30d158",
          true,
        );
      }
    });

    this.activeTransitionEvent = this.scene.time.delayedCall(
      MATCH_CONFIG.introDelayMs,
      () => {
        if (this.phase !== ROUND_PHASES.INTRO) return;
        this.phase = ROUND_PHASES.FIGHTING;
        if (this.onBannerUpdate) {
          this.onBannerUpdate("", "", "#ffffff", false);
        }
      },
    );
  }

  update(deltaMs) {
    if (this.phase !== ROUND_PHASES.FIGHTING) return;

    const safeDelta = deltaMs > 0 ? Math.min(deltaMs, 50) : 16.67;

    const f1Dead = this.fighter1.health <= 0;
    const f2Dead = this.fighter2.health <= 0;

    if (f1Dead || f2Dead) {
      if (f1Dead && f2Dead) {
        this.resolveRound("DRAW", "DOUBLE K.O.!");
      } else if (f2Dead) {
        this.resolveRound("P1", "K.O.!");
      } else {
        this.resolveRound("P2", "K.O.!");
      }
      return;
    }

    this.remainingTimeMs = Math.max(0, this.remainingTimeMs - safeDelta);

    if (this.remainingTimeMs <= 0) {
      if (this.fighter1.health > this.fighter2.health) {
        this.resolveRound("P1", "TIME OVER");
      } else if (this.fighter2.health > this.fighter1.health) {
        this.resolveRound("P2", "TIME OVER");
      } else {
        this.resolveRound("DRAW", "TIME OVER — DRAW");
      }
    }
  }

  resolveRound(winnerCode, reasonTitle) {
    if (this.phase !== ROUND_PHASES.FIGHTING) return;
    this.phase = ROUND_PHASES.ROUND_OVER;
    this.clearTimers();

    soundManager.playRoundKO();

    let subMessage = "ROUND DRAW";
    let bannerColor = "#ffd60a";

    if (winnerCode === "P1") {
      this.p1Wins += 1;
      subMessage = `${this.fighter1.characterData.name} WINS ROUND ${this.currentRound}`;
      bannerColor = "#ff3b30";
      this.fighter1.enterRoundEndPose(FIGHTER_STATES.VICTORY);
      this.fighter2.enterRoundEndPose(FIGHTER_STATES.DEFEAT);
    } else if (winnerCode === "P2") {
      this.p2Wins += 1;
      subMessage = `${this.fighter2.characterData.name} WINS ROUND ${this.currentRound}`;
      bannerColor = "#0a84ff";
      this.fighter2.enterRoundEndPose(FIGHTER_STATES.VICTORY);
      this.fighter1.enterRoundEndPose(FIGHTER_STATES.DEFEAT);
    } else {
      this.fighter1.enterRoundEndPose(FIGHTER_STATES.IDLE);
      this.fighter2.enterRoundEndPose(FIGHTER_STATES.IDLE);
    }

    if (this.onBannerUpdate) {
      this.onBannerUpdate(reasonTitle, subMessage, bannerColor, true);
    }

    const p1WonMatch = this.p1Wins >= this.roundsToWin;
    const p2WonMatch = this.p2Wins >= this.roundsToWin;
    const reachedMaxCap = this.currentRound >= 7;

    this.activeTransitionEvent = this.scene.time.delayedCall(
      MATCH_CONFIG.roundEndHoldMs,
      () => {
        if (p1WonMatch || p2WonMatch || reachedMaxCap) {
          this.finishMatch();
        } else {
          this.currentRound += 1;
          this.startRound();
        }
      },
    );
  }

  finishMatch() {
    this.phase = ROUND_PHASES.MATCH_OVER;
    this.clearTimers();

    if (this.onBannerUpdate) {
      this.onBannerUpdate("", "", "#ffffff", false);
    }

    let matchOutcome = "DRAW";
    let winnerFighter = null;
    let loserFighter = null;

    if (this.p1Wins > this.p2Wins) {
      matchOutcome = "P1";
      winnerFighter = this.fighter1;
      loserFighter = this.fighter2;
    } else if (this.p2Wins > this.p1Wins) {
      matchOutcome = "P2";
      winnerFighter = this.fighter2;
      loserFighter = this.fighter1;
    }

    soundManager.playMatchVictory(matchOutcome === "DRAW");

    if (this.onMatchEnd) {
      this.onMatchEnd({
        outcome: matchOutcome,
        winnerFighter,
        loserFighter,
        p1Wins: this.p1Wins,
        p2Wins: this.p2Wins,
        roundsPlayed: this.currentRound,
      });
    }
  }

  forceTimeOverForTest() {
    if (this.phase !== ROUND_PHASES.FIGHTING) return;
    this.remainingTimeMs = 0;
    this.update(16.67);
  }

  getDisplaySeconds() {
    return Math.ceil(this.remainingTimeMs / 1000);
  }

  isFighting() {
    return this.phase === ROUND_PHASES.FIGHTING;
  }

  clearTimers() {
    if (this.activeTransitionEvent) {
      this.activeTransitionEvent.remove(false);
      this.activeTransitionEvent = null;
    }
    if (this.introSubEvent) {
      this.introSubEvent.remove(false);
      this.introSubEvent = null;
    }
  }

  destroy() {
    this.clearTimers();
  }
}
