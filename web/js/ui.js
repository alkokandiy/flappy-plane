// Retro intro / game-over overlay. The game world keeps animating on the
// canvas behind it; this layer owns the title, PLAY button and scores.
// Pointer events pass through except on the button, so canvas taps,
// touch and keyboard keep working everywhere.

import { VEHICLES } from "./vehicles.js";

// Crash titles by cause of death — a random one every time.
const CRASH_TITLES = {
  // hit a tower
  pipe: [
    "We are so blessed",
    "We are the chosen ones",
    "It was promised 3,000 years ago.",
  ],
  // fell to the ground
  floor: ["What a shame.", "Wasted!", "What a pity"],
  // flew away
  sky: ["We're finished", "What a shame.", "Are you kidding me?"],
};

export class IntroUI {
  constructor(onPlay) {
    this.el = document.getElementById("intro");
    this.title = this.el.querySelector(".title");
    this.panel = this.el.querySelector(".panel");
    this.finalScore = document.getElementById("finalScore");
    this.bestScore = document.getElementById("bestScore");
    this.newBest = document.getElementById("newBest");
    this.playBtn = document.getElementById("playBtn");
    this.garageBtn = document.getElementById("garageBtn");
    // Title screen only: the car name replaces "PLANE" once picked.
    this.introTitle = "FLAPPY<br />PLANE";
    this.playBtn.addEventListener("click", (e) => {
      e.preventDefault();
      onPlay();
    });
    this.winVideo = document.getElementById("winVideo");
  }

  onGarage(fn) {
    this.garageBtn.addEventListener("click", (e) => {
      e.preventDefault();
      fn();
    });
  }

  setVehicleTitle(html) {
    this.introTitle = html;
  }

  show() {
    this.el.hidden = false;
  }

  hide() {
    this.el.hidden = true;
  }

  showIntro(best) {
    this.el.classList.remove("gameover", "win", "cause-pipe", "cause-floor", "cause-sky");
    this.title.innerHTML = this.introTitle;
    this.panel.hidden = true;
    this.playBtn.textContent = "▶ PLAY";
    this.bestScore.textContent = String(best);
    this.show();
  }

  showGameOver(score, best, isNewBest, cause = "pipe") {
    this.el.classList.remove("win");
    this.el.classList.add("gameover");
    this.el.classList.remove("cause-pipe", "cause-floor", "cause-sky");
    const safeCause = CRASH_TITLES[cause] ? cause : "pipe";
    this.el.classList.add(`cause-${safeCause}`);
    const titles = CRASH_TITLES[safeCause];
    this.title.textContent =
      titles[Math.floor(Math.random() * titles.length)];
    this.panel.hidden = false;
    this.finalScore.textContent = String(score);
    this.bestScore.textContent = String(best);
    this.newBest.hidden = !isNewBest;
    this.playBtn.textContent = "↻ RETRY";
    if (safeCause === "pipe") {
      this.playWinVideo();
    } else {
      this.stopWinVideo();
    }
    this.show();
  }

  showWin(score, best, isNewBest) {
    this.el.classList.remove("gameover", "cause-pipe", "cause-floor", "cause-sky");
    this.el.classList.add("win");
    this.title.textContent = "It was promised 3,000 years ago.";
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

// Vehicle select. Every card previews the real thing: the same
// vehicle.draw() the game calls, on a loop, flaring on a fake flap so
// you can see the thrusters before you commit.
export class GarageUI {
  constructor(makeVehicle, onSelect) {
    this.makeVehicle = makeVehicle;
    this.onSelect = onSelect;
    this.el = document.getElementById("garage");
    this.list = document.getElementById("garageList");
    this.backBtn = document.getElementById("garageBack");
    this.cards = [];
    this.raf = 0;
    this.t0 = performance.now();
    this.backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      this.close();
    });
    this.onClose = null;
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) this.close();
    });
    this.build();
  }

  build() {
    for (const meta of VEHICLES) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "vcard";
      card.dataset.id = meta.id;
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 200;
      const name = document.createElement("span");
      name.className = "vname";
      name.textContent = meta.name;
      const tag = document.createElement("span");
      tag.className = "vtag";
      tag.textContent = meta.tagline;
      card.append(canvas, name, tag);
      card.setAttribute("aria-label", `${meta.name} — ${meta.tagline}`);
      card.addEventListener("click", (e) => {
        e.preventDefault();
        this.select(meta.id);
      });
      this.list.appendChild(card);
      this.cards.push({ meta, card, ctx: canvas.getContext("2d"), canvas });
    }
  }

  select(id) {
    this.current = id;
    for (const c of this.cards) {
      c.card.classList.toggle("selected", c.meta.id === id);
    }
    this.onSelect(id);
  }

  open(selectedId, onClose) {
    this.onClose = onClose;
    // Vehicles are rebuilt on open: assets are ready by then, and a
    // fresh instance can never share state with the one in play.
    for (const c of this.cards) c.vehicle = this.makeVehicle(c.meta.id);
    this.select(selectedId);
    this.el.hidden = false;
    this.t0 = performance.now();
    this.loop();
  }

  close() {
    this.el.hidden = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.onClose) this.onClose();
  }

  get isOpen() {
    return !this.el.hidden;
  }

  loop = () => {
    const now = performance.now();
    const secs = (now - this.t0) / 1000;
    for (const c of this.cards) this.drawCard(c, secs);
    this.raf = requestAnimationFrame(this.loop);
  };

  drawCard(c, secs) {
    const { ctx, canvas, vehicle } = c;
    if (!vehicle) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Fake a flap every 1.4s so the thrusters put on a show.
    const phase = secs % 1.4;
    const thrust = 0.22 + 0.78 * Math.exp(-phase / 0.22);
    const bob = Math.sin(secs * 2.2) * 5;
    // Fit the widest vehicle, then give the plume room below.
    const scale = (canvas.width * 0.72) / vehicle.w;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height * 0.42 + bob);
    ctx.scale(scale, scale);
    ctx.rotate((Math.sin(secs * 2.2) * 4 * Math.PI) / 180);
    vehicle.draw(ctx, {
      t: secs * 30,
      thrust,
      mode: "shm",
      frameIdx: Math.floor(secs * 6) % (vehicle.frameCount || 1),
    });
    ctx.restore();
  }
}
