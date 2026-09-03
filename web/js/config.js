// Shared game constants. Ported 1:1 from the Python/pygame version
// (src/utils/window.py, src/entities/player.py, src/entities/pipe.py).
// Physics run on a fixed 30 Hz timestep (STEP), so these per-tick
// values behave exactly like the original.

export const WIDTH = 288;
export const HEIGHT = 512;
export const VIEWPORT_H = HEIGHT * 0.79; // floor line (y = 404.48)
export const FLOOR_H = HEIGHT - VIEWPORT_H;

export const STEP = 1 / 30;

// Countdown mode: you start with 11, every cleared tower is -1,
// reaching 0 finishes the run on the lose page.
export const START_SCORE = 11;

// Player (plane) physics
export const PLAYER = {
  w: 80,
  h: 26,
  startX: Math.floor(WIDTH * 0.2), // 57
  normal: {
    velY: -9,
    maxVelY: 10,
    minVelY: -8,
    accY: 1,
    rot: 80,
    velRot: -3,
    rotMin: -90,
    rotMax: 20,
    flapAcc: -9,
  },
  shm: {
    velY: 1,
    maxVelY: 4,
    minVelY: -4,
    accY: 0.5,
  },
  crash: { accY: 2, velY: 7, maxVelY: 15, velRot: -8 },
};

// Pipes (skyscrapers)
export const PIPES = {
  w: 52,
  h: 320,
  gap: 160,
  speed: 4, // px per tick (moves left)
  spawnX: WIDTH + 10, // 298
};

// Floor scroll
export const FLOOR = { speed: 4 };

// Layout (score digits; intro/game-over text lives in the HTML overlay)
export const LAYOUT = {
  scoreY: HEIGHT * 0.1,
};

// Forgiving hitbox shrink for the plane (px). Pipes use full rects.
export const HITBOX_SHRINK_X = 6;
export const HITBOX_SHRINK_Y = 5;

export const MUSIC_VOLUME = 0.4;
export const BEST_KEY = "flappyplane_best";
