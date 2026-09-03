// Retro intro / game-over overlay. The game world keeps animating on the
// canvas behind it; this layer owns the title, PLAY button and scores.
// Pointer events pass through except on the button, so canvas taps,
// touch and keyboard keep working everywhere.

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
    this.winVideo = document.getElementById("winVideo");
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
    this.stopWinVideo();
    this.show();
  }

  showGameOver(score, best, isNewBest) {
    this.el.classList.add("gameover");
    this.title.innerHTML = "GAME<br />OVER";
    this.panel.hidden = false;
    this.finalScore.textContent = String(score);
    this.bestScore.textContent = String(best);
    this.newBest.hidden = !isNewBest;
    this.playBtn.textContent = "↻ RETRY";
    this.playWinVideo();
    this.show();
  }

  playWinVideo() {
    try {
      this.winVideo.currentTime = 0;
      const p = this.winVideo.play();
      if (p && p.catch) p.catch(() => {});
    } catch {
      /* video optional */
    }
  }

  stopWinVideo() {
    try {
      this.winVideo.pause();
    } catch {
      /* ignore */
    }
  }
}
