export const WORLD = {
  width: 720,
  height: 1280,
  webX: 360,
  topLimit: 100,
  bottomLimit: 1190,
  spiderRadius: 22,
  climbSpeed: -235,
  slowedClimbSpeed: -125,
  dropSpeed: 455,
  climbAcceleration: 880,
  dropAcceleration: 1120,
  worldSpeed: 155,
  maxWorldSpeed: 285,
  spawnInterval: 1.6,
  minSpawnInterval: 0.74,
  distanceScale: 0.035,
} as const;

export const FIXED_STEP = 1 / 120;
