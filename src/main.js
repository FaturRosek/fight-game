import Phaser from "phaser";
import { gameConfig } from "./config/gameConfig.js";

function setupFullscreenButton(game) {
  const btn = document.getElementById("fullscreen-toggle-btn");
  if (!btn) return;

  const updateButtonLabel = () => {
    const isFs = Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement,
    );
    btn.innerHTML = isFs ? "&#x2715; EXIT FULL" : "&#x26F6; FULL SCREEN";
    if (game && game.scale) {
      setTimeout(() => game.scale.refresh(), 120);
    }
  };

  btn.addEventListener("click", async () => {
    const docEl = document.documentElement;
    const isFs = Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement,
    );

    try {
      if (!isFs) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        }
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock("landscape").catch(() => {});
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    } catch {
      return;
    }
  });

  document.addEventListener("fullscreenchange", updateButtonLabel);
  document.addEventListener("webkitfullscreenchange", updateButtonLabel);
  window.addEventListener("resize", () => {
    if (game && game.scale) {
      game.scale.refresh();
    }
  });
}

window.addEventListener("load", () => {
  const game = new Phaser.Game(gameConfig);
  setupFullscreenButton(game);
});
