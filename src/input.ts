import type { InputFrame, Mode } from './game';

export function framesFor(keys: Set<string>, mode: Mode): InputFrame {
  const leftUp = keys.has('KeyW');
  const leftDown = keys.has('KeyS');

  if (mode === 'two-player') {
    return {
      leftUp,
      leftDown,
      rightUp: keys.has('ArrowUp'),
      rightDown: keys.has('ArrowDown'),
    };
  }

  return {
    leftUp: leftUp || keys.has('ArrowUp'),
    leftDown: leftDown || keys.has('ArrowDown'),
    rightUp: false,
    rightDown: false,
  };
}

export class InputTracker {
  private readonly keys = new Set<string>();

  constructor(target: Document | Window = window) {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
  }

  frame(mode: Mode): InputFrame {
    return framesFor(this.keys, mode);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };
}
