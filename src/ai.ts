import { H, PADDLE_W, PADDLE_X, W, type Difficulty, type GameState } from './game';

export const AI_SPEED_FACTOR = {
  1: 0.45,
  2: 0.62,
  3: 0.85,
} as const;

// Exported so the difficulty ladder is directly testable: reaction lag and aim
// error both shrink from Easy (1) to Hard (3), while AI_SPEED_FACTOR rises.
export const REACTION_DELAY: Record<Difficulty, number> = {
  1: 24,
  2: 12,
  3: 5,
};

export const ERROR_MAGNITUDE: Record<Difficulty, number> = {
  1: 60,
  2: 34,
  3: 14,
};

const LATE_COMMIT_WINDOW: Record<Difficulty, number> = {
  1: 150,
  2: 120,
  3: 90,
};

const DEAD_ZONE = 6;
const LCG_M = 0x100000000;

function lcg(seed: number): number {
  return (seed * 1664525 + 1013904223) >>> 0;
}

function reflectY(y: number, minY: number, maxY: number): number {
  const span = maxY - minY;
  if (span <= 0) {
    return minY;
  }

  const period = span * 2;
  let offset = (y - minY) % period;
  if (offset < 0) {
    offset += period;
  }

  return offset <= span ? minY + offset : maxY - (offset - span);
}

function predictedInterceptY(s: GameState): number {
  if (s.ball.vx <= 0) {
    return H / 2;
  }

  const radius = s.ball.size / 2;
  const paddleFaceX = W - (PADDLE_X + PADDLE_W);
  const travel = paddleFaceX - radius - s.ball.x;
  if (travel <= 0) {
    return s.ball.y;
  }

  const time = travel / s.ball.vx;
  return reflectY(s.ball.y + s.ball.vy * time, radius, H - radius);
}

function deterministicError(seed: number, difficulty: Difficulty): number {
  return ((lcg(seed) / LCG_M) * 2 - 1) * ERROR_MAGNITUDE[difficulty];
}

function quantizedBallX(s: GameState, difficulty: Difficulty): number {
  if (s.ball.vx <= 0) {
    return Math.floor(s.ball.x / REACTION_DELAY[difficulty]);
  }

  const faceX = W - (PADDLE_X + PADDLE_W);
  const clampedX = Math.min(s.ball.x, faceX - LATE_COMMIT_WINDOW[difficulty]);
  return Math.floor(clampedX / REACTION_DELAY[difficulty]);
}

function targetSeed(s: GameState, difficulty: Difficulty): number {
  return (
    s.seed ^
    quantizedBallX(s, difficulty) ^
    (Math.floor(s.ball.y) << 1) ^
    (Math.floor(s.ball.vx) << 9) ^
    (Math.floor(s.ball.vy) << 17)
  ) >>> 0;
}

export function aiMove(s: GameState, difficulty: Difficulty): -1 | 0 | 1 {
  const movingTowardAi = s.ball.vx > 0;
  const targetBase = movingTowardAi ? predictedInterceptY(s) : H / 2;
  const target = targetBase + deterministicError(targetSeed(s, difficulty), difficulty);
  const paddleCenter = s.right.y + s.right.h / 2;
  const delta = target - paddleCenter;

  if (Math.abs(delta) < DEAD_ZONE) {
    return 0;
  }

  return delta < 0 ? -1 : 1;
}
