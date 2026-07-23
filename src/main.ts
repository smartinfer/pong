import { aiMove } from './ai';
import {
  DT,
  H,
  W,
  accumulate,
  newGame,
  reset,
  serve,
  setDifficulty,
  togglePause,
  update,
  type Difficulty,
  type GameState,
  type InputFrame,
} from './game';
import { InputTracker } from './input';
import { render } from './render';

const canvas = document.getElementById('game');

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Canvas element #game not found');
}

const context = canvas.getContext('2d');

if (!context) {
  throw new Error('2D context is not available');
}

canvas.width = W;
canvas.height = H;

const input = new InputTracker(window);
let state = newGame();
let acc = 0;
let lastTime = performance.now();

function resize(): void {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = `${Math.max(1, Math.floor(W * scale))}px`;
  canvas.style.height = `${Math.max(1, Math.floor(H * scale))}px`;
}

function currentInputFrame(): InputFrame {
  const frame = input.frame(state.mode);

  if (state.mode !== 'vs-ai') {
    return frame;
  }

  const move = aiMove(state, state.difficulty);
  return {
    ...frame,
    rightUp: move < 0,
    rightDown: move > 0,
  };
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.repeat) {
    return;
  }

  if (event.code === 'Space') {
    if (state.phase === 'start' || state.phase === 'serving') {
      state = serve(state);
    } else if (state.phase === 'playing' || state.phase === 'paused') {
      state = togglePause(state);
    }
    event.preventDefault();
    return;
  }

  if (event.code === 'KeyR') {
    state = reset(state);
    event.preventDefault();
    return;
  }

  if (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3') {
    state = setDifficulty(state, Number(event.code.slice(-1)) as Difficulty);
    event.preventDefault();
    return;
  }

  if (event.code === 'Digit0') {
    state = reset({
      ...state,
      mode: state.mode === 'vs-ai' ? 'two-player' : 'vs-ai',
    });
    event.preventDefault();
  }
}

function frame(now: number): void {
  const elapsedSeconds = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;

  const stepped = accumulate(acc, elapsedSeconds);
  acc = stepped.acc;

  for (let i = 0; i < stepped.steps; i += 1) {
    state = update(state, currentInputFrame(), DT);
  }

  render(context, state);
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', onKeyDown);
window.addEventListener('resize', resize);
resize();
render(context, state);
requestAnimationFrame(frame);
