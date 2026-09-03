// Entry point. ES modules, no dependencies, no build step.
// Frameworks (React/Vue/Svelte/...) can `import { Game } from "./js/game.js"`
// and mount it on their own <canvas> instead of using this file.

import { WIDTH, HEIGHT } from "./config.js";
import { loadAssets } from "./assets.js";
import { Game } from "./game.js";

async function boot() {
  const canvas = document.getElementById("game");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  try {
    const assets = await loadAssets();
    const game = new Game(canvas, assets);
    document.getElementById("loading").remove();
    canvas.classList.add("ready");
    game.run();
  } catch (err) {
    console.error(err);
    document.getElementById("loading").textContent =
      "Could not load game assets. Serve this folder over HTTP (e.g. `python3 -m http.server`) and reload.";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
