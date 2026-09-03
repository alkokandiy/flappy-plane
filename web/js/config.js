// Shared game constants. Ported 1:1 from the Python/pygame version
// (src/utils/window.py, src/entities/player.py, src/entities/pipe.py).
// Physics run on a fixed 30 Hz timestep (STEP), so these per-tick
// values behave exactly like the original.

export const WIDTH = 288;
export const HEIGHT = 512;
export const VIEWPORT_H = HEIGHT * 0.79; // floor line (y = 404.48)
export const FLOOR_H = HEIGHT - VIEWPORT_H;

export const STEP = 1 / 30;

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
  gap: 150,
  speed: 4.5, // px per tick (moves left)
  spawnX: WIDTH + 10, // 298
};

// Floor scroll
export const FLOOR = { speed: 4 };

// Layout (matches welcome_message.py / game_over.py / score.py)
export const LAYOUT = {
  messageY: Math.floor(HEIGHT * 0.12),
  gameOverY: Math.floor(HEIGHT * 0.2),
  scoreY: HEIGHT * 0.1,
};

// Forgiving hitbox shrink for the plane (px). Pipes use full rects.
export const HITBOX_SHRINK_X = 6;
export const HITBOX_SHRINK_Y = 5;

export const MUSIC_VOLUME = 0.4;
export const BEST_KEY = "flappyplane_best";
