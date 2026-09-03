// Game orchestration: splash -> play -> game over state machine,
// fixed-timestep simulation (30 Hz, same as the Python version),
// unified input for mouse (PC), touch (mobile) and keyboard.
// Rendering is side-effect free: update() owns all simulation.

import { LAYOUT, STEP, BEST_KEY, START_SCORE } from "./config.js";
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
    this.tickCount = 0;
    // Crash-page delay (1.2s at 30Hz): show the impact first, then the page.
    this.PANEL_DELAY_TICKS = 36;
    this.reset();
    this.ui.showIntro(this.best);
    this.bindInput();
  }

  reset() {
    this.background = new Background(this.assets.backgrounds);
    this.floor = new Floor(this.assets.base);
    this.player = new Player(this.assets.plane);
    this.pipes = new Pipes(this.assets.pipe, this.assets.hit);
    this.score = START_SCORE;
    this.lastPassedPair = null;
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
    this.tickCount += 1;
    if (this.state === "splash") {
      this.floor.tick();
      this.player.tick();
    } else if (this.state === "play") {
      if (this.player.collided(this.pipes, this.floor)) {
        this.onCrash();
        return;
      }
      for (const pair of this.pipes.pairs) {
        if (this.player.crossed(pair[0])) {
          this.score -= 1;
          this.sfx.point();
          this.lastPassedPair = pair;
          if (this.score <= 0) {
            this.score = 0;
            this.onCountdownComplete();
            return;
          }
          this.notePass();
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
      // Show the lost/win page 1.2s after the crash (and once landed),
      // so the impact moment is visible first.
      if (
        !this.panelShown &&
        this.landed &&
        this.tickCount - this.overTick >= this.PANEL_DELAY_TICKS
      ) {
        this.panelShown = true;
        this.ui.showGameOver(
          this.overScore,
          this.overBest,
          this.overIsNew,
          this.overCause
        );
      }
    }
  }

  // Best = most towers cleared in one run (START_SCORE - lowest left).
  notePass() {
    const passes = START_SCORE - this.score;
    if (passes > this.best) {
      this.best = passes;
      this.saveBest();
    }
  }

  saveBest() {
    try {
      localStorage.setItem(BEST_KEY, String(this.best));
    } catch {
      /* private mode etc. */
    }
  }

  onCountdownComplete() {
    // Countdown reached 0: flash the final tower, end on the lose page.
    this.pipes.markPair(this.lastPassedPair);
    this.beginOverScreen(0, "floor");
    const isNew = START_SCORE > this.best;
    if (isNew) {
      this.best = START_SCORE;
      this.saveBest();
    }
    this.overBest = this.best;
    this.overIsNew = isNew;
  }

  // Crash/page bookkeeping shared by both endings. The overlay itself
  // appears later (see update()), after the impact is visible.
  beginOverScreen(score, cause) {
    this.state = "over";
    this.landed = false;
    this.panelShown = false;
    this.overTick = this.tickCount;
    this.overScore = score;
    this.overBest = this.best;
    this.overIsNew = false;
    this.overCause = cause;
    this.player.setMode("crash");
    this.pipes.stop();
    this.floor.stop();
  }

  onCrash() {
    this.beginOverScreen(this.score, this.player.crashEntity);
    // Flash the crashed tower (pipe hits only).
    if (this.player.crashEntity === "pipe") {
      this.pipes.markPair(this.pipes.pairTouching(this.player.hitbox));
    }
    // Music keeps playing through the game-over screen; retry restarts it.
    if (this.player.crashEntity === "pipe") {
      this.sfx.hit();
      this.sfx.die();
    } else if (this.player.crashEntity === "floor") {
      this.sfx.hit();
    } else {
      this.sfx.die(); // flew away: whistle on the way down
    }
    this.pipes.stop();
    this.floor.stop();
    // Crashing with lives left shows the cause-based pipe-hit page.
    const passes = START_SCORE - this.score;
    const isNew = passes > this.best;
    if (isNew) {
      this.best = passes;
      this.saveBest();
    }
    this.overBest = this.best;
    this.overIsNew = isNew;
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
