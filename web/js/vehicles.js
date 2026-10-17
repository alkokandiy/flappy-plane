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

import { HITBOX_SHRINK_X, HITBOX_SHRINK_Y } from "./config.js";

export const VEHICLE_KEY = "flappyplane_vehicle";

// Catalogue shown in the VEHICLES menu, in order.
export const VEHICLES = [
  {
    id: "plane",
    name: "PAPER JET",
    tagline: "THE CLASSIC",
    title: "FLAPPY<br />PLANE",
  },
  {
    id: "car",
    name: "SKYWEDGE",
    tagline: "4x ROCKET HOVER",
    title: "FLAPPY<br />WEDGE",
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
  return {
    id: "plane",
    w: 80,
    h: 26,
    rotScale: 1,
    hitShrinkX: HITBOX_SHRINK_X,
    hitShrinkY: HITBOX_SHRINK_Y,
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
const CAR_BOX_W = 100; // design-space width the path below is drawn in

// Nozzle positions along the floor pan, front to back. They sit in the
// gaps between the wheels so no plume ever fires through a tyre.
const NOZZLES = [
  { x: 38, y: 10.4, r: 2.3 },
  { x: 12, y: 10.9, r: 3.0 },
  { x: -5, y: 11, r: 3.0 },
  { x: -41, y: 9.4, r: 2.3 },
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
  return {
    id: "car",
    w: CAR_W,
    h: CAR_H,
    // A car noses over far less than a paper plane: keep the physics
    // identical and just damp how much of it shows.
    rotScale: 0.62,
    hitShrinkX: 11,
    hitShrinkY: 9,
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
  drawBody(ctx, t, dead);
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
  // Smoke first, so the flame burns through it. Soft-edged (radial
  // gradient, not a flat disc) or it reads as bubbles at game scale.
  for (const [i, n] of NOZZLES.entries()) {
    for (let j = 0; j < 3; j++) {
      const p = (t * 0.045 + i * 0.13 + j * 0.333) % 1;
      const a = (1 - p) * 0.22 * thrust;
      if (a <= 0.01) continue;
      const r = 3 + p * 13;
      const sx = n.x - p * 9;
      const sy = n.y + 16 + p * 32;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      sg.addColorStop(0, `rgba(214,224,236,${a})`);
      sg.addColorStop(0.6, `rgba(190,203,219,${a * 0.5})`);
      sg.addColorStop(1, "rgba(180,194,212,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, 7);
      ctx.fill();
    }
  }

  // Flames burn additively so they glow over both day and night skies.
  ctx.globalCompositeOperation = "lighter";
  for (const [i, n] of NOZZLES.entries()) {
    const f = flicker(t, i);
    const len = (8 + 42 * thrust) * f;
    const wid = n.r * (1.15 + 0.55 * thrust);
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

function drawWheels(ctx, t, dead) {
  // Wheels hang below the floor pan while hovering, like the renders.
  const spin = dead ? 0 : t * 0.22;
  for (const cx of [25, -28]) {
    const cy = 11.5;
    const r = 8.6;
    // Tyre
    ctx.fillStyle = "#0d0f13";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 7);
    ctx.fill();
    // Rim dish
    ctx.fillStyle = "#23272e";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.74, 0, 7);
    ctx.fill();
    // Five spokes
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.fillStyle = "#878d98";
    for (let i = 0; i < 5; i++) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.moveTo(-1.5, 0);
      ctx.lineTo(1.5, 0);
      ctx.lineTo(0.9, -r * 0.68);
      ctx.lineTo(-0.9, -r * 0.68);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = "#b9bfc9";
    ctx.beginPath();
    ctx.arc(cx, cy, 1.9, 0, 7);
    ctx.fill();
  }
}

function drawWing(ctx) {
  // Blade + two struts off the rear deck.
  ctx.fillStyle = "#2a2e35";
  poly(ctx, [[-47, -6.5], [-44.6, -6.5], [-45.4, -14], [-47.8, -14]], "#2a2e35");
  poly(ctx, [[-35, -7], [-32.6, -7], [-34.6, -14], [-37, -14]], "#2a2e35");
  // Blade: lighter top face over a dark underside, so it reads as solid.
  poly(ctx, [[-54, -13.4], [-28, -15.8], [-27.4, -13.6], [-53.6, -11.2]], "#0f1116");
  poly(ctx, [[-54, -13.4], [-28, -15.8], [-28.6, -17.4], [-54.8, -15]], "#e8eaee");
  // Endplate.
  poly(ctx, [[-54.8, -15], [-51.4, -15.3], [-50.6, -10.6], [-54, -10.4]], "#c3c8d0");
}

function drawBody(ctx, t, dead) {
  // Outline, nose (+x) to tail (-x). The three facets below all hang
  // off these same points so the panels never drift apart.
  const BODY = [
    [50, 5.5], // nose tip
    [36, -0.5],
    [20, -4.2],
    [13, -4.6], // windscreen base
    [1, -11.4], // roof front
    [-15, -12.1], // roof rear
    [-31, -6.6], // rear glass base
    [-47, -5.4], // rear deck
    [-50, 3], // tail
    [-46, 9.5],
    [40, 10.6],
  ];

  // Soft contact shadow so the car doesn't float flat against the sky.
  ctx.save();
  ctx.globalAlpha = dead ? 0.1 : 0.18;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(-4, 19, 42, 4.5, 0, 0, 7);
  ctx.fill();
  ctx.restore();

  // 1. Top deck: the sliver of upper surface a 3/4 view shows.
  poly(
    ctx,
    [
      [50, 5.5],
      [36, -0.5],
      [20, -4.2],
      [13, -4.6],
      [1, -11.4],
      [-15, -12.1],
      [-31, -6.6],
      [-47, -5.4],
      [-50, 3],
      [-45, 0.6],
      [-30, -2.2],
      [-8, -3.4],
      [14, -1.6],
      [33, 2.6],
    ],
    "#f3f4f7"
  );

  // 2. Flank: the big white side panel.
  poly(
    ctx,
    [
      [50, 5.5],
      [33, 2.6],
      [14, -1.6],
      [-8, -3.4],
      [-30, -2.2],
      [-45, 0.6],
      [-50, 3],
      [-48, 5.4],
      [-30, 4.6],
      [0, 4.2],
      [30, 4.4],
      [44, 5.2],
    ],
    "#d4d8de"
  );

  // 3. Skirt: the shadowed lower blade, dark like the renders.
  poly(
    ctx,
    [
      [44, 5.2],
      [30, 4.4],
      [0, 4.2],
      [-30, 4.6],
      [-48, 5.4],
      [-46, 9.5],
      [40, 10.6],
    ],
    "#1b1e24"
  );

  // Wheel arches cut into the flank, square-edged like the concept.
  for (const cx of [25, -28]) {
    poly(
      ctx,
      [
        [cx - 10.5, 10.8],
        [cx - 8.6, 2.6],
        [cx + 8.6, 2.6],
        [cx + 10.5, 10.8],
      ],
      "#0b0d11"
    );
    poly(
      ctx,
      [
        [cx - 10.5, 4.4],
        [cx - 8.6, 1.2],
        [cx + 8.6, 1.2],
        [cx + 10.5, 4.4],
      ],
      "#e9ebef"
    );
  }

  // Canopy: one dark wedge of glass, with a hard sheen stripe.
  poly(
    ctx,
    [
      [13, -4.6],
      [1, -11.4],
      [-15, -12.1],
      [-31, -6.6],
      [-27, -5.2],
      [-6, -4.4],
      [10, -3.6],
    ],
    "#0a0d13"
  );
  ctx.save();
  ctx.globalAlpha = 0.5;
  poly(
    ctx,
    [
      [10.5, -5.2],
      [1.5, -10.4],
      [-9, -10.8],
      [-4, -6.4],
    ],
    "#5d7791"
  );
  ctx.restore();
  // Roof strip above the glass.
  poly(ctx, [[1, -11.4], [-15, -12.1], [-16.4, -13.2], [0.4, -12.6]], "#1a1d23");

  // Panel cuts: a door shut line and the rear vent slats.
  ctx.strokeStyle = "rgba(60,66,78,0.55)";
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(10, -3.4);
  ctx.lineTo(6, 3.8);
  ctx.moveTo(-18, -3.2);
  ctx.lineTo(-17, 4.3);
  ctx.stroke();
  ctx.strokeStyle = "rgba(40,45,55,0.7)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const x = -22 - i * 2.6;
    ctx.moveTo(x, -3.9);
    ctx.lineTo(x - 1.6, -1.6);
  }
  ctx.stroke();

  // Shoulder highlight along the crease.
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(47, 4.6);
  ctx.lineTo(33, 2.2);
  ctx.lineTo(14, -2);
  ctx.lineTo(-8, -3.8);
  ctx.lineTo(-30, -2.6);
  ctx.stroke();

  // Nose: splitter, headlight slit, side marker.
  poly(ctx, [[50, 5.5], [44, 5.2], [40, 10.6], [49, 7.6]], "#15181d");
  poly(ctx, [[46.8, 2.6], [39.5, 1.3], [39.3, 2.2], [46.6, 3.5]], "#eaf6ff");
  poly(ctx, [[17.5, 0.2], [13.5, -0.4], [13.3, 1], [17.3, 1.6]], "#ff9b2f");
  // Tail light bar.
  poly(ctx, [[-49.6, 0.4], [-45.4, 0.1], [-45.6, 2], [-49.8, 2.3]], "#ff3a2f");
}
