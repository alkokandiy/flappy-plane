// Game entities. Physics ported 1:1 from the Python version
// (src/entities/*.py); rendering uses Canvas 2D.

import {
  WIDTH,
  HEIGHT,
  VIEWPORT_H,
  PLAYER,
  PIPES,
  FLOOR,
  HITBOX_SHRINK_X,
  HITBOX_SHRINK_Y,
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
    ctx.drawImage(this.img, 0, 0, WIDTH, HEIGHT);
  }
}

export class Floor {
  constructor(img) {
    this.img = img;
    this.w = img.naturalWidth || img.width;
    this.h = img.naturalHeight || img.height;
    this.y = VIEWPORT_H;
    this.x = 0;
    this.velX = FLOOR.speed;
    this.xExtra = this.w - WIDTH; // 336 - 288 = 48
  }
  get rect() {
    return { x: 0, y: this.y, w: WIDTH, h: HEIGHT - this.y };
  }
  stop() {
    this.velX = 0;
  }
  tick() {
    this.x = -((-this.x + this.velX) % this.xExtra);
  }
  render(ctx) {
    ctx.drawImage(this.img, this.x, this.y);
  }
}

export class Pipe {
  constructor(img, x, y, flipped) {
    this.img = img;
    this.x = x;
    this.y = y;
    this.w = PIPES.w;
    this.h = PIPES.h;
    this.velX = -PIPES.speed;
    this.flipped = flipped;
  }
  get cx() {
    return this.x + this.w / 2;
  }
  get rect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
  tick() {
    this.x += this.velX;
  }
  render(ctx) {
    if (this.flipped) {
      ctx.save();
      ctx.translate(this.x, this.y + this.h);
      ctx.scale(1, -1);
      ctx.drawImage(this.img, 0, 0, this.w, this.h);
      ctx.restore();
    } else {
      ctx.drawImage(this.img, this.x, this.y, this.w, this.h);
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
  constructor(img) {
    this.img = img;
    this.pairs = [];
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
    return WIDTH - (last.x + last.w) > last.w * 2.5;
  }
  spawnInitial() {
    const [u1, l1] = PipePair.makeRandom(this.img, 0);
    u1.x = l1.x = WIDTH + PIPES.w * 3;
    const [u2, l2] = PipePair.makeRandom(this.img, 0);
    u2.x = l2.x = u1.x + PIPES.w * 3.5;
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
      this.pairs.push(PipePair.makeRandom(this.img, PIPES.spawnX));
    }
    // Rebuild (never splice while iterating) and keep pairs intact.
    this.pairs = this.pairs.filter(([u]) => u.x >= -u.w);
    for (const [u, l] of this.pairs) {
      u.tick();
      l.tick();
    }
  }
  render(ctx) {
    for (const [u, l] of this.pairs) {
      u.render(ctx);
      l.render(ctx);
    }
  }
}

const FLAP_FRAMES = [0, 1, 2, 1];

export class Player {
  constructor(frames) {
    this.frames = frames; // [up, mid, down] plane images
    this.w = PLAYER.w;
    this.h = PLAYER.h;
    this.x = PLAYER.startX;
    this.y = Math.floor((HEIGHT - this.h) / 2);
    this.minY = -2 * this.h;
    this.maxY = VIEWPORT_H - this.h * 0.75;
    this.frame = 0;
    this.imgIdx = 0;
    this.imgPos = 0;
    this.crashed = false;
    this.crashEntity = null;
    this.setMode("shm");
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
    // Advance wing animation, then mode physics (no drawing here).
    this.frame += 1;
    if (this.frame % 5 === 0) {
      this.imgPos = (this.imgPos + 1) % FLAP_FRAMES.length;
      this.imgIdx = FLAP_FRAMES[this.imgPos];
    }
    if (this.mode === "shm") this.tickShm();
    else if (this.mode === "normal") this.tickNormal();
    else if (this.mode === "crash") this.tickCrash();
  }
  render(ctx) {

    // pygame rotates counter-clockwise; canvas rotates clockwise -> negate
    const rad = (-this.rot * Math.PI) / 180;
    ctx.save();
    ctx.translate(this.cx, this.cy);
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
  let x = (WIDTH - totalW) / 2;
  for (const im of digits) {
    ctx.drawImage(im, x, y);
    x += im.width;
  }
}
