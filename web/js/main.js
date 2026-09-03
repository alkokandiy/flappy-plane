// Entry point. ES modules, no dependencies, no build step.
// Frameworks (React/Vue/Svelte/...) can `import { Game } from "./js/game.js"`
// and mount it on their own <canvas> instead of using this file.
//
// Orientation: portrait phones get the 288x512 cabinet, landscape
// screens (PC) get a 16:9 world. Same height and physics either way.

import { WORLD_W, HEIGHT, initWorld } from "./config.js";
import { loadAssets } from "./assets.js";
import { Game } from "./game.js";

function isLandscape() {
  return window.innerWidth >= window.innerHeight;
}

async function boot() {
  const landscape = isLandscape();
  initWorld(landscape);
  const canvas = document.getElementById("game");
  canvas.width = WORLD_W;
  canvas.height = HEIGHT;
  document
    .querySelector(".screen")
    .classList.toggle("landscape", landscape);
  // World geometry is fixed at boot: rebuild on orientation change.
  window.addEventListener("resize", () => {
    if (isLandscape() !== landscape) location.reload();
  });
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
