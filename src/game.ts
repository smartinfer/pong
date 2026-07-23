import { aiMove, AI_SPEED_FACTOR } from './ai';

export const W = 640;
export const H = 480;
export const DT = 1 / 60;
export const PADDLE_W = 12;
export const PADDLE_X = 24;

export type Phase = 'start' | 'serving' | 'playing' | 'paused' | 'gameover';
export type Side = 'left' | 'right';
export type Mode = 'vs-ai' | 'two-player';
export type Difficulty = 1 | 2 | 3;

export interface Paddle {
  y: number;
  h: number;
  speed: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

export interface InputFrame {
  leftUp: boolean;
  leftDown: boolean;
  rightUp: boolean;
  rightDown: boolean;
}

export interface GameState {
  phase: Phase;
  mode: Mode;
  difficulty: Difficulty;
  left: Paddle;
  right: Paddle;
  ball: Ball;
  scoreL: number;
  scoreR: number;
  serving: Side;
  seed: number;
}

const PADDLE_H = 80;
const PADDLE_SPEED = 300;
const BALL_SIZE = 10;
const BALL_OFFSET_X = 60;
const BALL_SPEED = 240;
const BALL_SPEED_Y_MAX = 120;
const LCG_A = 1664525;
const LCG_C = 1013904223;
const LCG_M = 0x100000000;
const SPEEDUP = 1.05;
const MAX_BALL_SPEED = 600;
const MAX_RETURN_VY = 320;
const RETURN_VY_SCALE = 260;
const ENGLISH_FACTOR = 0.35;

function lcg(seed: number): number {
  return (seed * LCG_A + LCG_C) >>> 0;
}

function centeredPaddle(): Paddle {
  return {
    y: (H - PADDLE_H) / 2,
    h: PADDLE_H,
    speed: PADDLE_SPEED,
  };
}

function makeBall(serving: Side, y: number = H / 2): Ball {
  return {
    x: serving === 'left' ? BALL_OFFSET_X : W - BALL_OFFSET_X,
    y,
    vx: 0,
    vy: 0,
    size: BALL_SIZE,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function movePaddle(paddle: Paddle, up: boolean, down: boolean, dt: number): Paddle {
  const delta = (down ? 1 : 0) - (up ? 1 : 0);
  return {
    ...paddle,
    y: clamp(paddle.y + delta * paddle.speed * dt, 0, H - paddle.h),
  };
}

function paddleVelocity(previousY: number, nextY: number, dt: number): number {
  if (dt <= 0) {
    return 0;
  }

  return (nextY - previousY) / dt;
}

function serveBall(serving: Side, seed: number): { ball: Ball; seed: number } {
  const seed1 = lcg(seed);
  const y = 80 + (seed1 / LCG_M) * (H - 160);

  const seed2 = lcg(seed1);
  const vy = (seed2 / LCG_M) * 2 * BALL_SPEED_Y_MAX - BALL_SPEED_Y_MAX;
  const vxSign = serving === 'left' ? 1 : -1;
  const vx = vxSign * Math.sqrt(BALL_SPEED * BALL_SPEED - vy * vy);

  return {
    ball: {
      ...makeBall(serving, y),
      vx,
      vy,
    },
    seed: seed2,
  };
}

function scorePoint(s: GameState, scoringSide: Side): GameState {
  const scoreL = s.scoreL + (scoringSide === 'left' ? 1 : 0);
  const scoreR = s.scoreR + (scoringSide === 'right' ? 1 : 0);
  const serving: Side = scoringSide === 'left' ? 'right' : 'left';
  const nextState: GameState = {
    ...s,
    phase: 'serving',
    ball: makeBall(serving),
    scoreL,
    scoreR,
    serving,
  };

  return winner(nextState) ? { ...nextState, phase: 'gameover' } : nextState;
}

function reflectFromLeft(ball: Ball, paddle: Paddle, paddleVelY: number): Ball {
  const offset = clamp((ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2), -1, 1);
  let vy = offset * RETURN_VY_SCALE;
  vy += ENGLISH_FACTOR * paddleVelY;
  vy = clamp(vy, -MAX_RETURN_VY, MAX_RETURN_VY);

  const currentSpeed = Math.hypot(ball.vx, ball.vy);
  const nextSpeed = Math.min(currentSpeed * SPEEDUP, MAX_BALL_SPEED);
  const maxVy = 0.866 * nextSpeed;
  const vyOut = clamp(vy, -maxVy, maxVy);
  const vxOut = Math.sqrt(Math.max(0, nextSpeed * nextSpeed - vyOut * vyOut));

  return {
    ...ball,
    x: PADDLE_X + PADDLE_W + ball.size / 2,
    vx: vxOut,
    vy: vyOut,
  };
}

function reflectFromRight(ball: Ball, paddle: Paddle, paddleVelY: number): Ball {
  const offset = clamp((ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2), -1, 1);
  let vy = offset * RETURN_VY_SCALE;
  vy += ENGLISH_FACTOR * paddleVelY;
  vy = clamp(vy, -MAX_RETURN_VY, MAX_RETURN_VY);

  const currentSpeed = Math.hypot(ball.vx, ball.vy);
  const nextSpeed = Math.min(currentSpeed * SPEEDUP, MAX_BALL_SPEED);
  const maxVy = 0.866 * nextSpeed;
  const vyOut = clamp(vy, -maxVy, maxVy);
  const vxOut = -Math.sqrt(Math.max(0, nextSpeed * nextSpeed - vyOut * vyOut));

  return {
    ...ball,
    x: W - PADDLE_X - PADDLE_W - ball.size / 2,
    vx: vxOut,
    vy: vyOut,
  };
}

function overlapsPaddle(ball: Ball, paddle: Paddle, paddleLeft: number, paddleRight: number): boolean {
  const half = ball.size / 2;
  const ballLeft = ball.x - half;
  const ballRight = ball.x + half;
  const ballTop = ball.y - half;
  const ballBottom = ball.y + half;

  return ballRight >= paddleLeft && ballLeft <= paddleRight && ballBottom >= paddle.y && ballTop <= paddle.y + paddle.h;
}

function crossedLeftPaddle(previousBall: Ball, nextBall: Ball, paddle: Paddle): boolean {
  const planeX = PADDLE_X + PADDLE_W;
  return previousBall.x >= planeX && nextBall.x <= planeX && nextBall.y >= paddle.y && nextBall.y <= paddle.y + paddle.h;
}

function crossedRightPaddle(previousBall: Ball, nextBall: Ball, paddle: Paddle): boolean {
  const planeX = W - PADDLE_X - PADDLE_W;
  return previousBall.x <= planeX && nextBall.x >= planeX && nextBall.y >= paddle.y && nextBall.y <= paddle.y + paddle.h;
}

function advanceBall(ball: Ball, dt: number): Ball {
  return {
    ...ball,
    x: ball.x + ball.vx * dt,
    y: ball.y + ball.vy * dt,
  };
}

export function newGame(
  mode: Mode = 'vs-ai',
  difficulty: Difficulty = 2,
  seed = 1,
): GameState {
  const serving: Side = 'left';

  return {
    phase: 'start',
    mode,
    difficulty,
    left: centeredPaddle(),
    right: centeredPaddle(),
    ball: makeBall(serving),
    scoreL: 0,
    scoreR: 0,
    serving,
    seed: seed >>> 0,
  };
}

export function update(s: GameState, inp: InputFrame, dt: number): GameState {
  if (s.phase !== 'playing') {
    return {
      ...s,
      left: { ...s.left },
      right: { ...s.right },
      ball: { ...s.ball },
    };
  }

  const left = movePaddle(s.left, inp.leftUp, inp.leftDown, dt);
  const leftVelY = paddleVelocity(s.left.y, left.y, dt);

  let right: Paddle;
  let rightVelY: number;

  if (s.mode === 'two-player') {
    right = movePaddle(s.right, inp.rightUp, inp.rightDown, dt);
    rightVelY = paddleVelocity(s.right.y, right.y, dt);
  } else {
    const aiDirection = aiMove(s, s.difficulty);
    right = movePaddle(s.right, aiDirection < 0, aiDirection > 0, dt * AI_SPEED_FACTOR[s.difficulty]);
    rightVelY = paddleVelocity(s.right.y, right.y, dt);
  }

  let ball = advanceBall(s.ball, dt);

  if (ball.vx < 0 && crossedLeftPaddle(s.ball, ball, left)) {
    ball = reflectFromLeft(ball, left, leftVelY);
  } else if (ball.vx > 0 && crossedRightPaddle(s.ball, ball, right)) {
    ball = reflectFromRight(ball, right, rightVelY);
  } else if (ball.vx < 0 && overlapsPaddle(ball, left, PADDLE_X, PADDLE_X + PADDLE_W)) {
    ball = reflectFromLeft(ball, left, leftVelY);
  } else if (ball.vx > 0 && overlapsPaddle(ball, right, W - PADDLE_X - PADDLE_W, W - PADDLE_X)) {
    ball = reflectFromRight(ball, right, rightVelY);
  }

  if (ball.y - ball.size / 2 < 0) {
    ball = {
      ...ball,
      y: ball.size / 2,
      vy: Math.abs(ball.vy),
    };
  } else if (ball.y + ball.size / 2 > H) {
    ball = {
      ...ball,
      y: H - ball.size / 2,
      vy: -Math.abs(ball.vy),
    };
  }

  if (ball.x > W) {
    return scorePoint(
      {
        ...s,
        left,
        right,
        ball,
      },
      'left',
    );
  }

  if (ball.x < 0) {
    return scorePoint(
      {
        ...s,
        left,
        right,
        ball,
      },
      'right',
    );
  }

  return {
    ...s,
    left,
    right,
    ball,
  };
}

export function serve(s: GameState): GameState {
  if (s.phase !== 'start' && s.phase !== 'serving') {
    return {
      ...s,
      left: { ...s.left },
      right: { ...s.right },
      ball: { ...s.ball },
    };
  }

  const served = serveBall(s.serving, s.seed);

  return {
    ...s,
    phase: 'playing',
    ball: served.ball,
    seed: served.seed,
    left: { ...s.left },
    right: { ...s.right },
  };
}

export function togglePause(s: GameState): GameState {
  const phase = s.phase === 'playing' ? 'paused' : s.phase === 'paused' ? 'playing' : s.phase;

  return {
    ...s,
    phase,
    left: { ...s.left },
    right: { ...s.right },
    ball: { ...s.ball },
  };
}

export function reset(s: GameState): GameState {
  return newGame(s.mode, s.difficulty, s.seed);
}

export function winner(s: GameState): Side | null {
  if (s.scoreL >= 11 && s.scoreL - s.scoreR >= 2) {
    return 'left';
  }

  if (s.scoreR >= 11 && s.scoreR - s.scoreL >= 2) {
    return 'right';
  }

  return null;
}

export function setDifficulty(s: GameState, difficulty: Difficulty): GameState {
  return {
    ...s,
    difficulty,
    left: { ...s.left },
    right: { ...s.right },
    ball: { ...s.ball },
  };
}

export function accumulate(acc: number, elapsed: number): { steps: number; acc: number } {
  const total = acc + elapsed;
  const steps = Math.floor(total / DT);

  return {
    steps,
    acc: total - steps * DT,
  };
}
