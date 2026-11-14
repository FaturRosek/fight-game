import { shouldShowTouchControls } from "../utils/helpers.js";
import { soundManager } from "./SoundManager.js";

export default class TouchControls {
  constructor(scene) {
    this.scene = scene;
    this.activeTouches = new Map();
    this.activePointers = new Map();
    this.heldActions = new Set();
    this.justPressedActions = new Set();
    this.buttons = new Map();
    this.enabled = true;

    this.buildDOMOverlay();
    this.bindEvents();
    this.refreshVisibility();

    scene.events.once("shutdown", () => this.destroy());
    scene.events.once("destroy", () => this.destroy());
  }

  buildDOMOverlay() {
    const existing = document.getElementById("ff-touch-controls");
    if (existing) existing.remove();

    this.root = document.createElement("div");
    this.root.id = "ff-touch-controls";
    this.root.className = "ff-touch-layer";

    const leftCluster = document.createElement("div");
    leftCluster.className = "ff-touch-cluster left";

    const dpadDefs = [
      { action: "left", label: "&#9664;", sub: "LEFT", cls: "dpad-left" },
      { action: "right", label: "&#9654;", sub: "RIGHT", cls: "dpad-right" },
      { action: "up", label: "&#9650;", sub: "JUMP", cls: "dpad-up" },
      { action: "down", label: "&#9660;", sub: "DUCK", cls: "dpad-down" },
    ];

    dpadDefs.forEach((def) => {
      const btn = this.createButtonElement(def);
      leftCluster.appendChild(btn);
    });

    const rightCluster = document.createElement("div");
    rightCluster.className = "ff-touch-cluster right";

    const atkDefs = [
      { action: "punch", label: "PUNCH", sub: "FAST", cls: "atk-punch" },
      { action: "kick", label: "KICK", sub: "HEAVY", cls: "atk-kick" },
      { action: "special", label: "SPEC", sub: "READY", cls: "atk-special" },
      { action: "block", label: "BLOCK", sub: "GUARD", cls: "atk-block" },
    ];

    atkDefs.forEach((def) => {
      const btn = this.createButtonElement(def);
      rightCluster.appendChild(btn);
    });

    this.root.appendChild(leftCluster);
    this.root.appendChild(rightCluster);
    document.body.appendChild(this.root);
  }

  createButtonElement(def) {
    const btn = document.createElement("div");
    btn.className = `ff-touch-btn ${def.cls}`;
    btn.dataset.action = def.action;
    btn.innerHTML = `<span>${def.label}</span><span class="sub">${def.sub}</span>`;
    this.buttons.set(def.action, btn);
    return btn;
  }

  bindEvents() {
    this.onTouchStart = (e) => {
      if (!this.enabled) return;
      soundManager.ensureContext();
      let handled = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const action = this.resolveActionAtPoint(t.clientX, t.clientY);
        if (action) {
          this.activeTouches.set(t.identifier, action);
          handled = true;
        }
      }
      if (handled) {
        e.preventDefault();
        this.recomputeHeldSet();
      }
    };

    this.onTouchMove = (e) => {
      if (!this.enabled) return;
      let changed = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (this.activeTouches.has(t.identifier)) {
          const nextAction = this.resolveActionAtPoint(t.clientX, t.clientY);
          const prevAction = this.activeTouches.get(t.identifier);
          if (nextAction !== prevAction) {
            if (nextAction) {
              this.activeTouches.set(t.identifier, nextAction);
            } else {
              this.activeTouches.delete(t.identifier);
            }
            changed = true;
          }
        }
      }
      if (changed) {
        e.preventDefault();
        this.recomputeHeldSet();
      }
    };

    this.onTouchEnd = (e) => {
      let changed = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (this.activeTouches.has(t.identifier)) {
          this.activeTouches.delete(t.identifier);
          changed = true;
        }
      }
      if (changed) {
        e.preventDefault();
        this.recomputeHeldSet();
      }
    };

    this.onPointerDown = (e) => {
      if (e.pointerType === "touch" || !this.enabled) return;
      const action = this.resolveActionAtPoint(e.clientX, e.clientY);
      if (action) {
        soundManager.ensureContext();
        this.activePointers.set(e.pointerId, action);
        this.recomputeHeldSet();
      }
    };

    this.onPointerUp = (e) => {
      if (this.activePointers.has(e.pointerId)) {
        this.activePointers.delete(e.pointerId);
        this.recomputeHeldSet();
      }
    };

    this.onContextMenu = (e) => {
      e.preventDefault();
    };

    this.onBlurOrHide = () => {
      this.releaseAll();
    };

    this.root.addEventListener("touchstart", this.onTouchStart, {
      passive: false,
    });
    this.root.addEventListener("touchmove", this.onTouchMove, {
      passive: false,
    });
    this.root.addEventListener("touchend", this.onTouchEnd, { passive: false });
    this.root.addEventListener("touchcancel", this.onTouchEnd, {
      passive: false,
    });
    this.root.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    this.root.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("blur", this.onBlurOrHide);
    document.addEventListener("visibilitychange", this.onBlurOrHide);
  }

  resolveActionAtPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const btn = el.closest(".ff-touch-btn");
    return btn ? btn.dataset.action : null;
  }

  recomputeHeldSet() {
    const nextHeld = new Set();
    this.activeTouches.forEach((action) => nextHeld.add(action));
    this.activePointers.forEach((action) => nextHeld.add(action));

    nextHeld.forEach((action) => {
      if (!this.heldActions.has(action)) {
        this.justPressedActions.add(action);
      }
    });

    this.heldActions = nextHeld;

    this.buttons.forEach((btn, action) => {
      if (this.heldActions.has(action)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  updateSpecialStatus(cooldownMs) {
    const specBtn = this.buttons.get("special");
    if (!specBtn) return;
    const subSpan = specBtn.querySelector(".sub");
    if (cooldownMs > 0) {
      specBtn.classList.add("cooldown");
      if (subSpan) subSpan.textContent = `${(cooldownMs / 1000).toFixed(1)}s`;
    } else {
      specBtn.classList.remove("cooldown");
      if (subSpan) subSpan.textContent = "READY";
    }
  }

  setEnabled(flag) {
    this.enabled = Boolean(flag);
    if (!this.enabled) {
      this.releaseAll();
    }
  }

  refreshVisibility() {
    if (!this.root) return;
    const visible = shouldShowTouchControls();
    if (visible) {
      this.root.classList.remove("hidden");
    } else {
      this.root.classList.add("hidden");
      this.releaseAll();
    }
  }

  isHeld(action) {
    return this.heldActions.has(action);
  }

  consumeJustPressed(action) {
    if (this.justPressedActions.has(action)) {
      this.justPressedActions.delete(action);
      return true;
    }
    return false;
  }

  releaseAll() {
    this.activeTouches.clear();
    this.activePointers.clear();
    this.heldActions.clear();
    this.justPressedActions.clear();
    this.buttons.forEach((btn) => btn.classList.remove("active"));
  }

  destroy() {
    this.releaseAll();
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    window.removeEventListener("blur", this.onBlurOrHide);
    document.removeEventListener("visibilitychange", this.onBlurOrHide);
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
  }
}
