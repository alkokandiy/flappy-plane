// Retro intro / game-over overlay. The game world keeps animating on the
// canvas behind it; this layer owns the title, PLAY button and scores.
// Pointer events pass through except on the button, so canvas taps,
// touch and keyboard keep working everywhere.

// Shown instead of "GAME OVER" — a random one every crash.
const CRASH_TITLES = [
  "We're finished",
  "What a shame.",
  "Are you kidding me?",
  "Forget it, it's over.",
  "What a blessing!",
  "We are so blessed",
  "We are the chosen ones",
];

export class IntroUI {
  constructor(onPlay) {
    this.el = document.getElementById("intro");
    this.title = this.el.querySelector(".title");
    this.panel = this.el.querySelector(".panel");
    this.finalScore = document.getElementById("finalScore");
    this.bestScore = document.getElementById("bestScore");
    this.newBest = document.getElementById("newBest");
    this.playBtn = document.getElementById("playBtn");
    this.playBtn.addEventListener("click", (e) => {
      e.preventDefault();
      onPlay();
    });
  }

  show() {
    this.el.hidden = false;
  }

  hide() {
    this.el.hidden = true;
  }

  showIntro(best) {
    this.el.classList.remove("gameover");
    this.title.innerHTML = "FLAPPY<br />PLANE";
    this.panel.hidden = true;
    this.playBtn.textContent = "▶ PLAY";
    this.bestScore.textContent = String(best);
    this.show();
  }

  showGameOver(score, best, isNewBest) {
    this.el.classList.add("gameover");
    this.title.textContent =
      CRASH_TITLES[Math.floor(Math.random() * CRASH_TITLES.length)];
    this.panel.hidden = false;
    this.finalScore.textContent = String(score);
    this.bestScore.textContent = String(best);
    this.newBest.hidden = !isNewBest;
    this.playBtn.textContent = "↻ RETRY";
    this.show();
  }
}
