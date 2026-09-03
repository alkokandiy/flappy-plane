// Game orchestration: splash -> play -> game over state machine,
// fixed-timestep simulation (30 Hz, same as the Python version),
// unified input for mouse (PC), touch (mobile) and keyboard.
// Rendering is side-effect free: update() owns all simulation.

import { LAYOUT, STEP, BEST_KEY } from "./config.js";
import { Background, Floor, Pipes, Player, drawScore } from "./entities.js";
import { SoundFX, Music } from "./audio.js";
import { IntroUI } from "./ui.js";

export class Game {
  constructor(canvas, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.assets = assets;
    this.sfx = new SoundFX();
    this.music = new Music();
    this.best = Number(localStorage.getItem(BEST_KEY) || 0);
    this.ui = new IntroUI(() => this.pressPlay());
    this.reset();
    this.ui.showIntro(this.best);
    this.bindInput();
  }

  reset() {
    this.background = new Background(this.assets.backgrounds);
    this.floor = new Floor(this.assets.base);
    this.player = new Player(this.assets.plane);
    this.pipes = new Pipes(this.assets.pipe);
    this.score = 0;
    this.state = "splash"; // splash | play | over
    this.landed = false;
  }

  // --- input: one physical press = exactly one tap (no hold-repeat) ---

  bindInput() {
    const tap = (e) => {
      if (e.cancelable) e.preventDefault();
      this.sfx.unlock(); // also unlocks Web Audio (autoplay policy)
      this.onTap();
    };
    this.canvas.addEventListener("mousedown", tap);
    // touchstart (not touchend/click): no 300ms delay, no double-fire
    this.canvas.addEventListener("touchstart", tap, { passive: false });
    window.addEventListener("keydown", (e) => {
      if ((e.code === "Space" || e.code === "ArrowUp") && !e.repeat) {
        e.preventDefault();
        this.sfx.unlock();
        this.onTap();
      }
    });
    // Music discovery runs in the background; silent when nothing found.
    this.music.findTrack();
  }

  pressPlay() {
    // PLAY / RETRY button: same path as tapping the screen.
    this.sfx.unlock();
    this.onTap();
  }

  onTap() {
    if (this.state === "splash") {
      this.startPlay();
    } else if (this.state === "play") {
      this.player.flap(this.sfx);
    } else if (this.state === "over" && this.landed) {
      this.reset();
      this.startPlay();
    }
  }

  startPlay() {
    this.state = "play";
    this.ui.hide();
    this.player.setMode("normal");
    this.sfx.wing();
    this.music.start(); // music only during real gameplay
  }

  // --- fixed-timestep simulation ---

  update() {
    if (this.state === "splash") {
      this.floor.tick();
      this.player.tick();
    } else if (this.state === "play") {
      if (this.player.collided(this.pipes, this.floor)) {
        this.onCrash();
        return;
      }
      for (const pipe of this.pipes.upper) {
        if (this.player.crossed(pipe)) {
          this.score += 1;
          this.sfx.point();
          if (this.score > this.best) {
            this.best = this.score;
            try {
              localStorage.setItem(BEST_KEY, String(this.best));
            } catch {
              /* private mode etc. */
            }
          }
        }
      }
      this.floor.tick();
      this.pipes.tick();
      this.player.tick();
    } else if (this.state === "over") {
      // World is frozen (velocities are 0); only the falling plane moves.
      this.player.tick();
      if (this.player.y + this.player.h >= this.floor.y - 1) {
        this.landed = true;
      }
    }
  }

  onCrash() {
    this.state = "over";
    this.landed = false;
    this.player.setMode("crash");
    this.music.stop(); // music plays only during gameplay
    this.sfx.hit();
    if (this.player.crashEntity === "pipe") this.sfx.die();
    this.pipes.stop();
    this.floor.stop();
    this.ui.showGameOver(
      this.score,
      this.best,
      this.score > 0 && this.score >= this.best
    );
  }

  // --- rendering (no side effects) ---

  render() {
    const ctx = this.ctx;
    this.background.draw(ctx);
    this.pipes.render(ctx);
    this.floor.render(ctx);
    this.player.render(ctx);

    // Score digits live on the canvas during play; the overlay panel
    // shows the final score on the intro / game-over screens.
    if (this.state === "play") {
      drawScore(ctx, this.assets.numbers, this.score, LAYOUT.scoreY);
    }
  }

  run() {
    let acc = 0;
    let last = performance.now();
    const loop = (now) => {
      acc += Math.min((now - last) / 1000, 0.25);
      last = now;
      while (acc >= STEP) {
        this.update();
        acc -= STEP;
      }
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
