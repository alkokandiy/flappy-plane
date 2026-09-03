// Game entities. Physics ported 1:1 from the Python version
// (src/entities/*.py); rendering uses Canvas 2D.

import {
  WORLD_W,
  HEIGHT,
  VIEWPORT_H,
  PLAYER,
  PIPES,
  FLOOR,
  HITBOX_SHRINK_X,
  HITBOX_SHRINK_Y,
  spawnX,
  spawnGap,
  speedFactor,
} from "./config.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rectsOverlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Background {
  constructor(img) {
    // Random day/night per run, like Images.randomize()
    this.img = Array.isArray(img) ? img[Math.floor(Math.random() * img.length)] : img;
  }
  draw(ctx) {
    // Tile the 288px sky across wide (landscape) worlds.
    const w = this.img.naturalWidth || this.img.width;
    for (let x = 0; x < WORLD_W; x += w) {
      ctx.drawImage(this.img, x, 0, w, HEIGHT);
    }
  }
}

export class Floor {
  constructor(img) {
    this.img = img;
    this.w = img.naturalWidth || img.width;
    this.h = img.naturalHeight || img.height;
    this.y = VIEWPORT_H;
    this.x = 0;
    this.px = 0;
    this.velX = FLOOR.speed * speedFactor();
    this.tileW = this.w; // ground texture loops every tile
  }
  get rect() {
    return { x: 0, y: this.y, w: WORLD_W, h: HEIGHT - this.y };
  }
  stop() {
    this.velX = 0;
  }
  tick() {
    this.px = this.x;
    this.x = -((-this.x + this.velX) % this.tileW);
  }
  render(ctx, a = 1) {
    const x0 = this.px + (this.x - this.px) * a;
    for (let x = x0; x < WORLD_W; x += this.tileW) {
      ctx.drawImage(this.img, x, this.y);
    }
  }
}

export class Pipe {
  constructor(img, x, y, flipped) {
    this.img = img;
    this.x = x;
    this.px = x;
    this.y = y;
    this.w = PIPES.w;
    this.h = PIPES.h;
    this.velX = -PIPES.speed * speedFactor();
    this.flipped = flipped;
  }
  get cx() {
    return this.x + this.w / 2;
  }
  get rect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
  tick() {
    this.px = this.x;
    this.x += this.velX;
  }
  render(ctx, a = 1) {
    // Interpolated x: buttery motion on 60/120Hz screens even though
    // physics steps at 30Hz. Collisions always use stepped positions.
    const x = this.px + (this.x - this.px) * a;
    if (this.flipped) {
      ctx.save();
      ctx.translate(x, this.y + this.h);
      ctx.scale(1, -1);
      ctx.drawImage(this.img, 0, 0, this.w, this.h);
      ctx.restore();
    } else {
      ctx.drawImage(this.img, x, this.y, this.w, this.h);
    }
  }
}

export class PipePair {
  // Always kept as upper+lower pairs so they can never desync.
  static makeRandom(img, x) {
    const gapY =
      Math.floor(Math.random() * (VIEWPORT_H * 0.6 - PIPES.gap)) +
      Math.floor(VIEWPORT_H * 0.2);
    const upper = new Pipe(img, x, gapY - PIPES.h, true);
    const lower = new Pipe(img, x, gapY + PIPES.gap, false);
    return [upper, lower];
  }
}

export class Pipes {
  constructor(img, hitImg = null, groundImg = null) {
    this.img = img;
    this.hitImg = hitImg; // tower rims (pipe crashes)
    this.groundImg = groundImg; // ground line (falls)
    this.pairs = [];
    // Impact flashes: marked pipe -> rim edge. Cleared automatically:
    // marks live on this instance and reset() builds a fresh Pipes.
    this.marked = new Map();
    this.spots = [];
    this.spawnInitial();
  }
  get upper() {
    return this.pairs.map((p) => p[0]);
  }
  get lower() {
    return this.pairs.map((p) => p[1]);
  }
  canSpawn() {
    if (this.pairs.length === 0) return true;
    const last = this.pairs[this.pairs.length - 1][0];
    return WORLD_W - (last.x + last.w) > spawnGap();
  }
  spawnInitial() {
    // Portrait numbers are the classic tuned values. Wide screens start
    // the action ~1.7s in with rhythm scaled to match.
    const legacy = WORLD_W <= 300;
    const f = speedFactor();
    const x1 = legacy
      ? WORLD_W + PIPES.w * 3
      : WORLD_W * PLAYER.startXFrac + PIPES.speed * f * 50;
    const gap = legacy ? PIPES.w * 3.5 : spawnGap() + PIPES.w;
    const [u1, l1] = PipePair.makeRandom(this.img, 0);
    u1.x = l1.x = x1;
    const [u2, l2] = PipePair.makeRandom(this.img, 0);
    u2.x = l2.x = u1.x + gap;
    this.pairs.push([u1, l1], [u2, l2]);
  }
  stop() {
    for (const [u, l] of this.pairs) {
      u.velX = 0;
      l.velX = 0;
    }
  }
  tick() {
    if (this.canSpawn()) {
      this.pairs.push(PipePair.makeRandom(this.img, spawnX()));
    }
    // Rebuild (never splice while iterating) and keep pairs intact.
    this.pairs = this.pairs.filter(([u]) => u.x >= -u.w);
    for (const [u, l] of this.pairs) {
      u.tick();
      l.tick();
    }
  }
  render(ctx, a = 1) {
    for (const [u, l] of this.pairs) {
      u.render(ctx, a);
      l.render(ctx, a);
    }
    // One flash per hit pipe (upper: bottom rim, lower: top rim).
    for (const [pipe, edge] of this.marked) {
      this.renderMarker(ctx, pipe, edge, 110);
    }
    for (const spot of this.spots) {
      this.renderSpot(ctx, spot.x, spot.y, 140);
    }
  }

  markPair(pair) {
    // Both rims (countdown finale — nothing was hit).
    if (pair) {
      this.marked.set(pair[0], "bottom");
      this.marked.set(pair[1], "top");
    }
  }

  markSingle(pipe, edge) {
    // Only the pipe that was actually hit.
    if (pipe) this.marked.set(pipe, edge);
  }

  markSpot(x, y) {
    this.spots.push({ x, y });
  }

  pipeTouching(box) {
    for (const [u, l] of this.pairs) {
      if (rectsOverlap(box, u.rect)) return [u, "bottom"];
      if (rectsOverlap(box, l.rect)) return [l, "top"];
    }
    return [null, null];
  }

  renderMarker(ctx, pipe, edge, w = 160) {
    if (!this.hitImg) return;
    const natW = this.hitImg.naturalWidth || this.hitImg.width;
    const natH = this.hitImg.naturalHeight || this.hitImg.height;
    const h = (w * natH) / natW;
    const x = pipe.x + (pipe.w - w) / 2;
    const y = edge === "bottom" ? pipe.y + pipe.h - h / 2 : pipe.y - h / 2;
    ctx.drawImage(this.hitImg, x, y, w, h);
  }

  renderSpot(ctx, x, y, w = 140) {
    if (!this.groundImg) return;
    const natW = this.groundImg.naturalWidth || this.groundImg.width;
    const natH = this.groundImg.naturalHeight || this.groundImg.height;
    const h = (w * natH) / natW;
    ctx.drawImage(this.groundImg, x - w / 2, y - h / 2, w, h);
  }
}

const FLAP_FRAMES = [0, 1, 2, 1];

export class Player {
  constructor(frames) {
    this.frames = frames; // [up, mid, down] plane images
    this.w = PLAYER.w;
    this.h = PLAYER.h;
    this.x = Math.floor(WORLD_W * PLAYER.startXFrac);
    this.y = Math.floor((HEIGHT - this.h) / 2);
    this.minY = -2 * this.h;
    this.maxY = VIEWPORT_H - this.h * 0.75;
    this.frame = 0;
    this.imgIdx = 0;
    this.imgPos = 0;
    this.crashed = false;
    this.crashEntity = null;
    this.setMode("shm");
    this.py = this.y;
    this.prot = this.rot;
  }
  get cx() {
    return this.x + this.w / 2;
  }
  get cy() {
    return this.y + this.h / 2;
  }
  // Forgiving hitbox (slightly smaller than the sprite)
  get hitbox() {
    return {
      x: this.x + HITBOX_SHRINK_X,
      y: this.y + HITBOX_SHRINK_Y,
      w: this.w - HITBOX_SHRINK_X * 2,
      h: this.h - HITBOX_SHRINK_Y * 2,
    };
  }
  setMode(mode) {
    this.mode = mode;
    if (mode === "normal") {
      Object.assign(this, { ...PLAYER.normal, flapped: false });
    } else if (mode === "shm") {
      Object.assign(this, {
        ...PLAYER.shm,
        rot: 0,
        velRot: 0,
        rotMin: 0,
        rotMax: 0,
        flapAcc: 0,
        flapped: false,
      });
    } else if (mode === "crash") {
      this.accY = PLAYER.crash.accY;
      this.velY = PLAYER.crash.velY;
      this.maxVelY = PLAYER.crash.maxVelY;
      this.velRot = PLAYER.crash.velRot;
    }
  }
  flap(sfx) {
    if (this.y > this.minY) {
      this.velY = this.flapAcc;
      this.flapped = true;
      this.rot = 80;
      if (sfx) sfx.wing();
    }
  }
  rotate() {
    this.rot = clamp(this.rot + this.velRot, this.rotMin, this.rotMax);
  }
  tickShm() {
    if (this.velY >= this.maxVelY || this.velY <= this.minVelY) this.accY *= -1;
    this.velY += this.accY;
    this.y += this.velY;
  }
  tickNormal() {
    if (this.velY < this.maxVelY && !this.flapped) this.velY += this.accY;
    if (this.flapped) this.flapped = false;
    this.y = clamp(this.y + this.velY, this.minY, this.maxY);
    this.rotate();
  }
  tickCrash() {
    if (this.minY <= this.y && this.y <= this.maxY) {
      this.y = clamp(this.y + this.velY, this.minY, this.maxY);
      if (this.crashEntity !== "floor") this.rotate();
    }
    if (this.velY < this.maxVelY) this.velY += this.accY;
  }
  crossed(pipe) {
    return pipe.cx <= this.cx && this.cx < pipe.cx - pipe.velX;
  }
  collided(pipes, floor) {
    const hb = this.hitbox;
    // Flew off the top of the screen: lost.
    if (this.y <= -this.h) {
      this.crashed = true;
      this.crashEntity = "sky";
      return true;
    }
    if (rectsOverlap(hb, floor.rect)) {
      this.crashed = true;
      this.crashEntity = "floor";
      return true;
    }
    for (const pipe of [...pipes.upper, ...pipes.lower]) {
      if (rectsOverlap(hb, pipe.rect)) {
        this.crashed = true;
        this.crashEntity = "pipe";
        return true;
      }
    }
    return false;
  }
  tick() {
    // Snapshot for render interpolation, then mode physics.
    // (No drawing here.)
    this.py = this.y;
    this.prot = this.rot;
    this.frame += 1;
    if (this.frame % 5 === 0) {
      this.imgPos = (this.imgPos + 1) % FLAP_FRAMES.length;
      this.imgIdx = FLAP_FRAMES[this.imgPos];
    }
    if (this.mode === "shm") this.tickShm();
    else if (this.mode === "normal") this.tickNormal();
    else if (this.mode === "crash") this.tickCrash();
  }
  render(ctx, a = 1) {
    // Interpolated position/rotation: smooth on any refresh rate.
    const y = this.py + (this.y - this.py) * a;
    const rot = this.prot + (this.rot - this.prot) * a;
    // pygame rotates counter-clockwise; canvas rotates clockwise -> negate
    const rad = (-rot * Math.PI) / 180;
    ctx.save();
    ctx.translate(this.cx, y + this.h / 2);
    ctx.rotate(rad);
    ctx.drawImage(this.frames[this.imgIdx], -this.w / 2, -this.h / 2, this.w, this.h);
    ctx.restore();
  }
}

export function drawScore(ctx, numbers, score, y) {
  const digits = String(score)
    .split("")
    .map((d) => numbers[Number(d)]);
  const totalW = digits.reduce((s, im) => s + im.width, 0);
  let x = (WORLD_W - totalW) / 2;
  for (const im of digits) {
    ctx.drawImage(im, x, y);
    x += im.width;
  }
}
