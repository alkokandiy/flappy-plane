// Vehicle registry. Each vehicle owns its size, its forgiving hitbox and
// its own draw() — nothing else in the game knows what it looks like.
//
// draw(ctx, s) renders the vehicle centred on the origin, facing right,
// already rotated by the caller. It must be side-effect free: everything
// it animates comes out of `s`, so two draws of the same state are
// identical (the menu previews rely on this too).
//
//   s = { t, thrust, mode, frameIdx }
//     t        continuous time in ticks (30Hz) incl. render interpolation
//     thrust   0..1 engine power, spikes to 1 on every flap
//     mode     "shm" | "normal" | "crash"
//     frameIdx current sprite frame (sprite-sheet vehicles only)

import {
  HITBOX_SHRINK_X,
  HITBOX_SHRINK_Y,
  vehicleScale,
} from "./config.js";

export const VEHICLE_KEY = "flappyplane_vehicle";

// Catalogue shown in the VEHICLES menu, in order.
export const VEHICLES = [
  {
    id: "plane",
    name: "BOEING 767",
    tagline: "THE CLASSIC",
    title: "FLAPPY<br />PLANE",
  },
  {
    id: "car",
    name: "TELSA ROADSTART",
    tagline: "4x ROCKET HOVER",
    title: "FLAPPY<br />ROADSTART",
  },
];

export const DEFAULT_VEHICLE = "plane";

export function loadSelected() {
  try {
    const id = localStorage.getItem(VEHICLE_KEY);
    return VEHICLES.some((v) => v.id === id) ? id : DEFAULT_VEHICLE;
  } catch {
    return DEFAULT_VEHICLE;
  }
}

export function saveSelected(id) {
  try {
    localStorage.setItem(VEHICLE_KEY, id);
  } catch {
    /* private mode etc. */
  }
}

export function vehicleMeta(id) {
  return VEHICLES.find((v) => v.id === id) || VEHICLES[0];
}

// --- factory -------------------------------------------------------

export function createVehicle(id, assets) {
  return id === "car" ? makeCar() : makePlane(assets.plane);
}

// --- the original plane (3-frame sprite) ----------------------------

function makePlane(frames) {
  const k = vehicleScale();
  return {
    id: "plane",
    w: 80 * k,
    h: 26 * k,
    rotScale: 1,
    hitShrinkX: HITBOX_SHRINK_X * k,
    hitShrinkY: HITBOX_SHRINK_Y * k,
    frameCount: frames.length,
    draw(ctx, s) {
      const img = frames[s.frameIdx % frames.length];
      ctx.drawImage(img, -this.w / 2, -this.h / 2, this.w, this.h);
    },
  };
}

// --- the flying wedge -----------------------------------------------
//
// Drawn as flat faceted panels (top deck / flank / skirt) rather than
// gradients: that is what sells a 2D shape as a 3/4 solid, the same way
// the concept renders do. Everything lives in a 100 x 44 design box
// (x: -50..50 nose right, y: -22..22) and is scaled to w/h at the end.

const CAR_W = 92;
const CAR_H = 38;

// Pearl white over silver, read off the photos. The three paint facets
// are flat fills, not a gradient: that is what sells the hard creases.
const TOP_FACET = "#f8f9fb";
const FLANK_FACET = "#dee2e8";
const LOWER_FACET = "#b2b8c2";
const SKIRT = "#15171c";
const TRIM_DARK = "#23272e";
const GLASS = "#0a0d13";
const CAR_BOX_W = 100; // design-space width the path below is drawn in

// Nozzle positions along the floor pan, front to back. They sit in the
// gaps between the wheels so no plume ever fires through a tyre.
const NOZZLES = [
  { x: 37, y: 10.4, r: 2.2 },
  { x: 10, y: 10, r: 3.0 },
  { x: -6, y: 9.9, r: 3.0 },
  { x: -41, y: 9, r: 2.2 },
];

// Deterministic per-nozzle flicker: no particle state, so the preview
// canvases and the game draw the exact same flame for the same t.
function flicker(t, i) {
  return (
    1 +
    0.17 * Math.sin(t * 1.9 + i * 2.3) +
    0.1 * Math.sin(t * 4.7 + i * 1.1) +
    0.06 * Math.sin(t * 11.3 + i * 5.0)
  );
}

function poly(ctx, pts, fill, stroke, lw = 0.6) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function makeCar() {
  const k = vehicleScale();
  return {
    id: "car",
    w: CAR_W * k,
    h: CAR_H * k,
    // A car noses over far less than a paper plane: keep the physics
    // identical and just damp how much of it shows.
    rotScale: 0.62,
    hitShrinkX: 11 * k,
    hitShrinkY: 9 * k,
    frameCount: 1,
    draw(ctx, s) {
      const k = this.w / CAR_BOX_W;
      ctx.save();
      ctx.scale(k, k);
      drawCar(ctx, s);
      ctx.restore();
    },
  };
}

function drawCar(ctx, s) {
  const t = s.t;
  const dead = s.mode === "crash";
  const thrust = dead ? 0 : s.thrust;

  drawExhaust(ctx, t, thrust, dead);
  drawWheels(ctx, t, dead);
  drawWing(ctx);
  drawBody(ctx);
}

// A soft puff, drawn once into an offscreen canvas and then stamped
// hundreds of times a second. Building it out of overlapping lobes
// gives the cauliflower edge a single radial gradient cannot, and
// caching it keeps the whole smoke bank to one drawImage per puff.
let PUFF_CACHE = null;

function puffTexture(i) {
  if (!PUFF_CACHE) {
    PUFF_CACHE = [0, 1, 2].map((seed) => {
      const S = 128;
      const c = document.createElement("canvas");
      c.width = S;
      c.height = S;
      const g = c.getContext("2d");
      for (let k = 0; k < 7; k++) {
        const ang = (k / 7) * Math.PI * 2 + seed * 1.9;
        const d = S * (0.1 + 0.09 * (((k * 7 + seed * 3) % 5) / 5));
        const x = S / 2 + Math.cos(ang) * d;
        const y = S / 2 + Math.sin(ang) * d;
        const r = S * (0.2 + 0.09 * (((k * 3 + seed) % 4) / 4));
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, "rgba(255,255,255,0.46)");
        rg.addColorStop(0.5, "rgba(250,252,255,0.2)");
        rg.addColorStop(1, "rgba(245,249,255,0)");
        g.fillStyle = rg;
        g.beginPath();
        g.arc(x, y, r, 0, 7);
        g.fill();
      }
      return c;
    });
  }
  return PUFF_CACHE[i % PUFF_CACHE.length];
}

function stamp(ctx, tex, x, y, r, a) {
  if (a <= 0.02) return;
  ctx.globalAlpha = a;
  ctx.drawImage(tex, x - r, y - r, r * 2, r * 2);
}

// Smoke covers a big area in soft, low-contrast pixels, which makes it
// by far the most fill-hungry thing on screen — and the cost scales
// with the square of the render scale, so a 2x phone pays 4x. It is
// also the one thing that loses nothing by being drawn at lower
// resolution, so it goes into a small offscreen buffer and gets
// composited up in a single drawImage. Same look, a fraction of the
// pixels touched.
const SMOKE_REGION = { x: -128, y: -2, w: 236, h: 148 };
const SMOKE_BUF_SCALE = 0.7;
let SMOKE_BUF = null;
let SMOKE_CTX = null;

function smokeBuffer() {
  if (!SMOKE_BUF) {
    SMOKE_BUF = document.createElement("canvas");
    SMOKE_BUF.width = Math.ceil(SMOKE_REGION.w * SMOKE_BUF_SCALE);
    SMOKE_BUF.height = Math.ceil(SMOKE_REGION.h * SMOKE_BUF_SCALE);
    SMOKE_CTX = SMOKE_BUF.getContext("2d");
  }
  return SMOKE_CTX;
}

// The column each nozzle kicks up: a thin jet that blossoms into a
// billowing bank far below, plus the wisps that peel off sideways.
// Everything is a function of (t, thrust), so there is no particle
// state to keep and the menu previews match the game exactly.
function drawSmokeBank(ctx, t, thrust) {
  const R = SMOKE_REGION;
  const S = SMOKE_BUF_SCALE;
  const b = smokeBuffer();
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.clearRect(0, 0, SMOKE_BUF.width, SMOKE_BUF.height);
  // World units -> buffer pixels, so every stamp below keeps using
  // the same coordinates the rest of the car is drawn in.
  b.setTransform(S, 0, 0, S, -R.x * S, -R.y * S);

  // Puff count follows the throttle: a flap gets the full billowing
  // mass, the idle burn between flaps gets a thin trail.
  const N = 4 + Math.round(thrust * 12);
  for (const [i, n] of NOZZLES.entries()) {
    // One continuous column per nozzle: it leaves the nozzle thin and
    // bright, then billows out as it falls away. Opaque almost at
    // once, so it reads as exhaust rather than haze floating nearby.
    for (let j = 0; j < N; j++) {
      const p = (t * 0.02 + i * 0.17 + j / N) % 1;
      const spread = (((i * 3 + j * 5) % 7) / 7 - 0.5) * 2;
      stamp(
        b,
        puffTexture(i + j),
        n.x - p * 6 + spread * p * p * 24,
        n.y + 3 + p * 88,
        3.5 + p * 28,
        thrust * 0.52 * Math.min(1, p * 7) * (1 - p) ** 0.55
      );
    }
    // Wisps peeling sideways once the column has spread out. Only
    // worth drawing when the engines are actually working.
    for (let j = 0; thrust > 0.45 && j < 3; j++) {
      const p = (t * 0.04 + i * 0.29 + j / 3) % 1;
      stamp(
        b,
        puffTexture(i + j + 1),
        n.x - 12 - p * 40,
        n.y + 42 + p * 30 - Math.sin(p * 3.1) * 6,
        8 + p * 16,
        thrust * 0.24 * Math.sin(Math.PI * p)
      );
    }
  }
  b.globalAlpha = 1;
  ctx.globalAlpha = 1;
  ctx.drawImage(SMOKE_BUF, R.x, R.y, R.w, R.h);
}

// Rocket plumes + the smoke column they kick up.
function drawExhaust(ctx, t, thrust, dead) {
  if (dead) {
    // Engines out: a thin trail of black smoke instead of fire.
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const p = ((t * 0.09 + i * 0.2) % 1);
      const a = (1 - p) * 0.34;
      const r = 3 + p * 12;
      ctx.globalAlpha = a;
      ctx.fillStyle = "#22262c";
      ctx.beginPath();
      ctx.arc(-34 - p * 26, 2 - p * 8 + Math.sin(t * 0.5 + i) * 2, r, 0, 7);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  if (thrust <= 0.01) return;

  ctx.save();
  // Smoke first, so the flames burn through it.
  drawSmokeBank(ctx, t, thrust);

  // Flames burn additively so they glow over both day and night skies.
  ctx.globalCompositeOperation = "lighter";
  for (const [i, n] of NOZZLES.entries()) {
    const f = flicker(t, i);
    const len = (5 + 15 * thrust) * f;
    const wid = n.r * (0.95 + 0.4 * thrust);
    // The car is moving forward, so the column rakes back as it falls.
    const drift = -len * 0.13;

    // Outer plume: a wide column that frays, not a spike.
    const g = ctx.createLinearGradient(n.x, n.y, n.x, n.y + len);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.16, "rgba(206,234,255,0.95)");
    g.addColorStop(0.42, "rgba(126,180,255,0.6)");
    g.addColorStop(0.72, "rgba(84,138,246,0.26)");
    g.addColorStop(1, "rgba(60,110,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(n.x - wid, n.y);
    ctx.bezierCurveTo(
      n.x - wid * 1.25,
      n.y + len * 0.5,
      n.x + drift - wid * 1.45,
      n.y + len * 0.8,
      n.x + drift - wid * 0.35,
      n.y + len
    );
    ctx.bezierCurveTo(
      n.x + drift + wid * 1.1,
      n.y + len * 0.86,
      n.x + wid * 1.3,
      n.y + len * 0.5,
      n.x + wid,
      n.y
    );
    ctx.closePath();
    ctx.fill();

    // White-hot core.
    const cl = len * 0.4;
    const cw = wid * 0.62;
    const cg = ctx.createLinearGradient(n.x, n.y, n.x, n.y + cl);
    cg.addColorStop(0, "rgba(255,255,255,1)");
    cg.addColorStop(0.6, "rgba(255,246,214,0.85)");
    cg.addColorStop(1, "rgba(255,190,120,0)");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(n.x - cw, n.y);
    ctx.quadraticCurveTo(n.x - cw * 0.8, n.y + cl * 0.75, n.x, n.y + cl);
    ctx.quadraticCurveTo(n.x + cw * 0.8, n.y + cl * 0.75, n.x + cw, n.y);
    ctx.closePath();
    ctx.fill();

    // Nozzle glow.
    const rg = ctx.createRadialGradient(n.x, n.y + 1, 0, n.x, n.y + 1, 9 * f);
    rg.addColorStop(0, `rgba(190,225,255,${0.55 * thrust})`);
    rg.addColorStop(1, "rgba(120,180,255,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(n.x, n.y + 1, 9 * f, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

// --- the shell -------------------------------------------------------
//
// Read off the reference photos. The car is a hard-edged wedge, so the
// volume is carried by flat facets meeting at creases, never gradients:
// a bright top deck, a mid-silver flank, a darker lower panel, and a
// black rocker under all three. Those four bands are what make a flat
// drawing read as a solid body seen from three-quarters.
//
// OUTLINE is the silhouette, nose (+x) to tail (-x). SHOULDER and HIP
// are the two creases; every facet is built from slices of these three
// lists, so the panels can never drift apart when a point is nudged.

const OUTLINE = [
  [48.4, 3.4], // nose tip, barely above the splitter
  [38, -0.6],
  [22, -4.6],
  [15, -5.6], // windscreen base
  [2, -12.6], // roof front
  [-12, -13.3], // roof rear
  [-34, -8.6], // fastback
  [-47, -7.1], // rear deck
  [-50, -1.2], // tail
  [-46, 9],
  [40, 10.5],
];

// Crease between the top deck and the flank.
const SHOULDER = [
  [48.4, 3.4],
  [35, 1.4],
  [16, -2.4],
  [-10, -4.6],
  [-34, -5.4],
  [-48, -5],
];

// Crease between the flank and the darker lower panel.
const HIP = [
  [46.4, 4.6],
  [30, 2.5],
  [0, 1.7],
  [-30, 1.5],
  [-48, -1.3],
];

// Top of the black rocker. It climbs at the tail, where the photos show
// the whole lower rear going dark into the diffuser.
const ROCKER = [
  [45.4, 6.2],
  [30, 4.2],
  [0, 3.4],
  [-30, 3],
  [-47, 0.2],
];

const rev = (pts) => [...pts].reverse();

function drawWheels(ctx, t, dead) {
  // Big dark five-spokes that fill the arches, as in the photos.
  const spin = dead ? 0 : t * 0.2;
  for (const cx of [24, -27]) {
    const cy = 9.2;
    const r = 9.2;
    ctx.fillStyle = "#0b0d11";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#1c2027";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.73, 0, 7);
    ctx.fill();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.fillStyle = "#6f7680";
    for (let i = 0; i < 5; i++) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(2, 0);
      ctx.lineTo(1.1, -r * 0.66);
      ctx.lineTo(-1.1, -r * 0.66);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = "#aeb5bf";
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, 7);
    ctx.fill();
  }
}

// Long flat blade on two pylons, overhanging the tail with its top edge
// above the roofline — the loudest thing on the car in the photos.
function drawWing(ctx) {
  // Pylons first, so the blade caps them. They stand on the rear deck
  // and the blade's underside overlaps their tops, so the three parts
  // always read as one assembly.
  poly(ctx, [[-47.8, -7.0], [-44.4, -7.0], [-45.4, -15.2], [-48.4, -15.2]], TRIM_DARK);
  poly(ctx, [[-34, -8.7], [-30.6, -8.7], [-31.8, -15.9], [-34.8, -15.9]], TRIM_DARK);
  // Blade: bright top face over a dark underside = a solid slab.
  poly(ctx, [[-55, -15.2], [-26, -16.2], [-25.8, -14.2], [-54.8, -13.2]], TRIM_DARK);
  poly(ctx, [[-55, -15.2], [-26, -16.2], [-26.2, -18], [-55.2, -17]], TOP_FACET);
  // Endplate standing off the outboard tip.
  poly(ctx, [[-55.4, -17.3], [-51.8, -17.4], [-51.2, -12.6], [-54.8, -12.5]], "#c9ced6");
}

function drawBody(ctx) {
  // 1. Top deck — the sliver of upper surface a 3/4 view shows.
  poly(ctx, [...OUTLINE.slice(0, 9), ...rev(SHOULDER)], TOP_FACET);
  // 2. Flank — the big body side.
  poly(ctx, [...SHOULDER, ...rev(HIP)], FLANK_FACET);
  // 3. Lower panel — same paint, turned away from the light.
  poly(ctx, [...HIP, ...rev(ROCKER)], LOWER_FACET);
  // 4. Rocker — black, full length, climbing into the diffuser.
  poly(ctx, [...ROCKER, [-46, 9], [40, 10.5]], SKIRT);

  // Square flat-topped arches cut through all four bands, then the
  // flared lip that sits proud of the flank above each one.
  for (const cx of [24, -27]) {
    poly(
      ctx,
      [
        [cx - 11, 10.6],
        [cx - 9.6, 1.6],
        [cx + 9.6, 1.6],
        [cx + 11, 10.6],
      ],
      "#0a0c10"
    );
    poly(
      ctx,
      [
        [cx - 11, 3.4],
        [cx - 9.6, 0],
        [cx + 9.6, 0],
        [cx + 11, 3.4],
      ],
      TOP_FACET
    );
  }

  // Canopy: windscreen, roof and rear glass as one dark wedge.
  poly(
    ctx,
    [
      [15, -5.6],
      [2, -12.6],
      [-12, -13.3],
      [-30, -9.5],
      [-26, -7.6],
      [-4, -6.2],
      [12, -4.6],
    ],
    GLASS
  );
  ctx.save();
  ctx.globalAlpha = 0.45;
  poly(ctx, [[12.4, -6], [2.6, -11.6], [-8, -12], [-2.4, -7.4]], "#5d7791");
  ctx.restore();
  // Black roof panel along the top of the glass.
  poly(ctx, [[2, -12.6], [-12, -13.3], [-13.4, -14.5], [1.4, -13.8]], TRIM_DARK);

  // Vent slats on the rear quarter, behind the glass.
  ctx.strokeStyle = "rgba(30,34,42,0.75)";
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const x = -20 - i * 2.8;
    ctx.moveTo(x, -6.4);
    ctx.lineTo(x - 1.8, -4.2);
  }
  ctx.stroke();

  // Door shut line.
  ctx.strokeStyle = "rgba(90,98,112,0.5)";
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(12, -4.2);
  ctx.lineTo(8, 3.4);
  ctx.moveTo(-15, -4.8);
  ctx.lineTo(-16, 3.2);
  ctx.stroke();

  // Crisp highlight riding the shoulder crease.
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(SHOULDER[0][0] - 3, SHOULDER[0][1]);
  for (const [x, y] of SHOULDER.slice(1)) ctx.lineTo(x, y);
  ctx.stroke();

  // Nose: black splitter, thin light slit, orange door marker.
  poly(ctx, [[48.4, 3.4], [46.4, 4.6], [40, 10.5], [48.2, 6.4]], SKIRT);
  poly(ctx, [[47.6, 1.4], [38.6, -0.2], [38.3, 1.2], [47.3, 2.8]], TRIM_DARK);
  poly(ctx, [[47, 1.8], [39.4, 0.4], [39.2, 1.2], [46.8, 2.6]], "#eaf6ff");
  poly(ctx, [[19, -0.6], [14.6, -1.3], [14.4, 0.2], [18.8, 0.9]], "#ff9b2f");
  // Tail light bar above the diffuser.
  poly(ctx, [[-49.8, -0.6], [-44.6, -1.4], [-44.8, 0.8], [-50, 1.6]], "#ff3a2f");
}
