import { GameSession } from "../utils/helpers.js";

class SoundManager {
  constructor() {
    this.ctx = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  getSfxGain() {
    const raw = GameSession?.settings?.sfxVolume ?? 85;
    return Math.max(0, Math.min(1, raw / 100));
  }

  playSwing(type = "punch") {
    const ctx = this.ensureContext();
    const volume = this.getSfxGain();
    if (!ctx || volume <= 0) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    const startFreq = type === "kick" ? 190 : type === "special" ? 280 : 240;
    const endFreq = type === "kick" ? 55 : 80;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.11);

    gain.gain.setValueAtTime(0.18 * volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playHit(attackState = "PUNCH", blocked = false) {
    const ctx = this.ensureContext();
    const volume = this.getSfxGain();
    if (!ctx || volume <= 0) return;

    const now = ctx.currentTime;

    if (blocked) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(210, now + 0.09);

      gain.gain.setValueAtTime(0.22 * volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
      return;
    }

    const isHeavy = attackState === "KICK" || attackState === "SPECIAL";
    const duration = attackState === "SPECIAL" ? 0.26 : isHeavy ? 0.18 : 0.13;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isHeavy ? "sawtooth" : "sine";

    const baseFreq = attackState === "SPECIAL" ? 150 : isHeavy ? 120 : 160;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + duration);

    gain.gain.setValueAtTime(
      (attackState === "SPECIAL" ? 0.42 : 0.32) * volume,
      now,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);

    this.playNoiseBurst(duration * 0.8, (isHeavy ? 0.28 : 0.18) * volume);
  }

  playNoiseBurst(duration, gainLevel) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 950;

    const gain = ctx.createGain();
    gain.gain.value = gainLevel;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  playJump() {
    const ctx = this.ensureContext();
    const volume = this.getSfxGain();
    if (!ctx || volume <= 0) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.12);

    gain.gain.setValueAtTime(0.16 * volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  playLand() {
    const ctx = this.ensureContext();
    const volume = this.getSfxGain();
    if (!ctx || volume <= 0) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.09);

    gain.gain.setValueAtTime(0.2 * volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }
}

export const soundManager = new SoundManager();
