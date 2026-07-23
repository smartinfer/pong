// Regression suite — the deterministic behavior contract for the game core.
// Do not weaken: every change must keep this green.
import { describe, it, expect } from 'vitest'
import { newGame, update, serve, togglePause, reset, winner, setDifficulty, accumulate, W, H, DT, PADDLE_X, PADDLE_W } from '../src/game'
import { aiMove, AI_SPEED_FACTOR } from '../src/ai'
const N = { leftUp: false, leftDown: false, rightUp: false, rightDown: false }

describe('core state', () => {
  it('initial 0-0, start, vs-ai; deterministic for a seed', () => {
    const s = newGame()
    expect([s.scoreL, s.scoreR, s.phase, s.mode]).toEqual([0, 0, 'start', 'vs-ai'])
    expect(JSON.stringify(newGame('vs-ai', 2, 42))).toBe(JSON.stringify(newGame('vs-ai', 2, 42)))
  })
})

describe('paddles', () => {
  it('moves by speed*dt; dt-scaled', () => {
    let s = serve(newGame()); const y0 = s.left.y
    s = update(s, { ...N, leftUp: true }, DT)
    expect(y0 - s.left.y).toBeCloseTo(s.left.speed * DT, 6)
  })
  it('clamped exactly (two-player drives both)', () => {
    let s = serve(newGame('two-player'))
    for (let i = 0; i < 900; i++) s = update(s, { ...N, leftDown: true, rightUp: true }, DT)
    expect(s.left.y).toBe(H - s.left.h); expect(s.right.y).toBe(0)
  })
  it('pause freezes paddles AND ball', () => {
    let s = togglePause(serve(newGame()))
    const f = JSON.stringify([s.left.y, s.right.y, s.ball.x, s.ball.y])
    for (let i = 0; i < 60; i++) s = update(s, { ...N, leftDown: true }, DT)
    expect(JSON.stringify([s.left.y, s.right.y, s.ball.x, s.ball.y])).toBe(f)
  })
})

describe('ball and walls', () => {
  it('advances linearly', () => {
    const s = serve(newGame()); s.ball = { x: 320, y: 240, vx: 60, vy: 50, size: 10 }
    const t = update(s, N, DT)
    expect(t.ball.x).toBeCloseTo(320 + 60 * DT, 6); expect(t.ball.y).toBeCloseTo(240 + 50 * DT, 6)
  })
  it('top wall bounce preserves speed', () => {
    let s = serve(newGame()); s.ball = { x: 320, y: 30, vx: 60, vy: -300, size: 10 }
    for (let i = 0; i < 60 && s.ball.vy < 0; i++) s = update(s, N, DT)
    expect(s.ball.vy).toBeGreaterThan(0)
    expect(Math.hypot(s.ball.vx, s.ball.vy)).toBeCloseTo(Math.hypot(60, 300), 4)
    expect(s.ball.y).toBeGreaterThanOrEqual(0)
  })
  it('bottom wall bounce at max speed (no tunneling)', () => {
    let s = serve(newGame()); s.ball = { x: 320, y: H - 30, vx: 60, vy: 600, size: 10 }
    for (let i = 0; i < 60 && s.ball.vy > 0; i++) s = update(s, N, DT)
    expect(s.ball.vy).toBeLessThan(0); expect(s.ball.y).toBeLessThanOrEqual(H)
  })
})

describe('paddle collision', () => {
  function toward(offsetFrac: number, inp = N) {
    const s = serve(newGame())
    const p = s.left
    s.ball = { x: 80, y: p.y + p.h / 2 + offsetFrac * (p.h / 2), vx: -240, vy: 0, size: 10 }
    return s
  }
  function untilFlip(s: any, inp = N) {
    for (let i = 0; i < 120 && s.ball.vx < 0; i++) s = update(s, inp, DT)
    return s
  }
  it('reflects off the left paddle with 5% speedup', () => {
    const s = untilFlip(toward(0))
    expect(s.ball.vx).toBeGreaterThan(0)
    expect(s.ball.x).toBeGreaterThan(PADDLE_X + PADDLE_W)
    expect(Math.hypot(s.ball.vx, s.ball.vy)).toBeCloseTo(240 * 1.05, 1)
  })
  it('impact offset sets vy (top<0, center~0, bottom>0)', () => {
    expect(untilFlip(toward(-0.9)).ball.vy).toBeLessThan(0)
    expect(Math.abs(untilFlip(toward(0)).ball.vy)).toBeLessThan(1e-6)
    expect(untilFlip(toward(0.9)).ball.vy).toBeGreaterThan(0)
  })
  it('moving bat imparts english', () => {
    // Fast approach (2-3 ticks) aimed slightly above center so the impact
    // lands near the RISING paddle's center: offset ~0, english dominates.
    const s = serve(newGame())
    s.ball = { x: 60, y: s.left.y + s.left.h / 2 - 12, vx: -480, vy: 0, size: 10 }
    let m = s
    for (let i = 0; i < 60 && m.ball.vx < 0; i++) m = update(m, { ...N, leftUp: true }, DT)
    expect(m.ball.vx).toBeGreaterThan(0) // it must actually hit the bat
    expect(m.ball.vy).toBeLessThan(-40)  // english pulled it upward
  })
})

describe('scoring and match end', () => {
  function exitRight() {
    const s = serve(newGame())
    s.ball = { x: W - 2, y: 60, vx: 600, vy: 0, size: 10 }
    s.right.y = 400; s.left.y = 400
    return s
  }
  function run(s: any) { for (let i = 0; i < 240 && s.phase === 'playing'; i++) s = update(s, N, DT); return s }
  it('left scores when ball exits right; server is the scored-against side', () => {
    const s = run(exitRight())
    expect([s.scoreL, s.phase, s.serving]).toEqual([1, 'serving', 'right'])
  })
  it('win requires >=11 and lead >=2; terminal phase is gameover', () => {
    const a = newGame(); a.scoreL = 11; a.scoreR = 10; expect(winner(a)).toBeNull()
    const b = newGame(); b.scoreL = 12; b.scoreR = 10; expect(winner(b)).toBe('left')
    let s = exitRight(); s.scoreL = 10; s.scoreR = 3
    s = run(s)
    expect(s.scoreL).toBe(11); expect(s.phase).toBe('gameover')
  })
  it('reset returns to start 0-0', () => {
    const r = reset(run(exitRight()))
    expect([r.scoreL, r.scoreR, r.phase]).toEqual([0, 0, 'start'])
  })
  it('serve: exactly 240, angled >=40, height varied in [80,400], deterministic', () => {
    const a = serve(newGame('vs-ai', 2, 7)); const b = serve(newGame('vs-ai', 2, 7))
    expect(JSON.stringify(a.ball)).toBe(JSON.stringify(b.ball))
    expect(a.ball.vx).toBeGreaterThan(0)
    expect(Math.abs(a.ball.vy)).toBeGreaterThanOrEqual(40)
    expect(Math.abs(a.ball.vy)).toBeLessThanOrEqual(168)
    expect(Math.hypot(a.ball.vx, a.ball.vy)).toBeCloseTo(240, 3)
    expect(a.ball.y).toBeGreaterThanOrEqual(80); expect(a.ball.y).toBeLessThanOrEqual(400)
    const seen = new Set([3, 4, 5, 6].map(seed => {
      const s = serve(newGame('vs-ai', 2, seed)); return `${s.ball.y.toFixed(1)}:${s.ball.vy.toFixed(1)}`
    }))
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('AI (fallible, no teleport)', () => {
  function incoming(y: number) {
    const s = serve(newGame()); s.ball = { x: 360, y, vx: 240, vy: 0, size: 10 }
    s.right.y = (H - s.right.h) / 2
    return s
  }
  it('moves toward the incoming ball', () => {
    expect(aiMove(incoming(40), 3)).toBe(-1)
    expect(aiMove(incoming(H - 40), 3)).toBe(1)
  })
  it('never exceeds its speed factor (no teleport)', () => {
    let s = incoming(30)
    for (let i = 0; i < 300; i++) {
      const y0 = s.right.y
      s = update(s, N, DT)
      expect(Math.abs(s.right.y - y0)).toBeLessThanOrEqual(AI_SPEED_FACTOR[s.difficulty] * s.right.speed * DT + 1e-9)
    }
  })
  it('deterministic', () => {
    const run1 = () => { let s = incoming(60); const ys: number[] = []
      for (let i = 0; i < 200; i++) { s = update(s, N, DT); ys.push(s.right.y) } return ys.join(',') }
    expect(run1()).toBe(run1())
  })
  it('difficulty orders closest approach to the intercept (hard best)', () => {
    const closest = (d: 1 | 2 | 3) => {
      let s = incoming(30); s.difficulty = d
      let best = Infinity
      for (let i = 0; i < 240 && s.phase === 'playing'; i++) {
        s = update(s, N, DT)
        best = Math.min(best, Math.abs((s.right.y + s.right.h / 2) - 30))
      }
      return best
    }
    const e = closest(1), m = closest(2), h = closest(3)
    expect(h).toBeLessThanOrEqual(m + 1e-9)
    expect(m).toBeLessThanOrEqual(e + 1e-9)
    expect(h).toBeLessThan(e)
    expect(h).toBeLessThan(30) // hard must genuinely track a top-region ball
  })
  it('easy AND medium are beatable by the corner shot', () => {
    for (const d of [1, 2] as const) {
      let s = incoming(30); s.difficulty = d
      s.right.y = H - s.right.h
      for (let i = 0; i < 600 && s.phase === 'playing'; i++) s = update(s, N, DT)
      expect(s.scoreL, `difficulty ${d}`).toBe(1)
    }
  })
})

describe('phases and loop helpers', () => {
  it('serve works from start and serving; pause toggles', () => {
    expect(serve(newGame()).phase).toBe('playing')
    const p = togglePause(serve(newGame()))
    expect(p.phase).toBe('paused'); expect(togglePause(p).phase).toBe('playing')
  })
  it('setDifficulty + accumulate', () => {
    expect(setDifficulty(newGame(), 3).difficulty).toBe(3)
    const r = accumulate(0, 0.05)
    expect(r.steps).toBe(3); expect(r.acc).toBeCloseTo(0.05 - 3 * DT, 9)
  })
})
