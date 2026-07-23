import { H, PADDLE_W, PADDLE_X, W, winner, type Difficulty, type GameState } from './game';

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  1: 'EASY',
  2: 'MEDIUM',
  3: 'HARD',
};

export function render(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.save();

  ctx.fillStyle = '#05070b';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(180, 255, 255, 0.45)';
  ctx.lineWidth = 4;
  if (typeof ctx.setLineDash === 'function') {
    ctx.setLineDash([10, 12]);
  }
  ctx.beginPath();
  ctx.moveTo(W / 2, 24);
  ctx.lineTo(W / 2, H - 24);
  ctx.stroke();
  if (typeof ctx.setLineDash === 'function') {
    ctx.setLineDash([]);
  }

  ctx.fillStyle = '#3cf6ff';
  ctx.fillRect(PADDLE_X, s.left.y, PADDLE_W, s.left.h);

  ctx.fillStyle = '#ff4fd8';
  ctx.fillRect(W - PADDLE_X - PADDLE_W, s.right.y, PADDLE_W, s.right.h);

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#9ffcff';
  ctx.shadowBlur = 14;
  ctx.fillRect(
    s.ball.x - s.ball.size / 2,
    s.ball.y - s.ball.size / 2,
    s.ball.size,
    s.ball.size,
  );
  ctx.restore();

  ctx.fillStyle = '#e8f7ff';
  ctx.font = "bold 32px 'Courier New', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(String(s.scoreL), W / 2 - 64, 24);
  ctx.fillText(String(s.scoreR), W / 2 + 64, 24);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 1);
  }

  ctx.fillStyle = '#f4fbff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (s.phase === 'start') {
    ctx.font = "bold 48px 'Courier New', monospace";
    ctx.fillText('PONG', W / 2, H / 2 - 132);

    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.fillStyle = '#7ef9ff';
    ctx.fillText(`VS AI    DIFFICULTY: ${DIFFICULTY_LABEL[s.difficulty]}`, W / 2, H / 2 - 92);

    ctx.font = "16px 'Courier New', monospace";
    ctx.fillStyle = '#f4fbff';
    const legend = [
      'W/S OR ARROWS   -   MOVE PADDLE',
      'SPACE   -   SERVE / PAUSE',
      'R   -   RESET MATCH',
      '1 / 2 / 3   -   EASY / MEDIUM / HARD',
    ];
    legend.forEach((line, i) => {
      ctx.fillText(line, W / 2, H / 2 - 48 + i * 26);
    });

    ctx.font = "bold 18px 'Courier New', monospace";
    ctx.fillStyle = '#ffe08a';
    ctx.fillText('FIRST TO 11, WIN BY 2', W / 2, H / 2 + 74);

    ctx.font = "bold 22px 'Courier New', monospace";
    ctx.fillStyle = '#f4fbff';
    ctx.fillText('PRESS SPACE TO SERVE', W / 2, H / 2 + 112);
  } else if (s.phase === 'paused') {
    ctx.font = "bold 42px 'Courier New', monospace";
    ctx.fillText('PAUSED', W / 2, H / 2);
  } else if (s.phase === 'gameover') {
    const winSide = winner(s);
    const label = winSide === 'left' ? 'LEFT WINS' : winSide === 'right' ? 'RIGHT WINS' : 'GAME WINS';
    ctx.font = "bold 36px 'Courier New', monospace";
    ctx.fillText(label, W / 2, H / 2 - 18);
    ctx.font = "bold 24px 'Courier New', monospace";
    ctx.fillText('PRESS R', W / 2, H / 2 + 28);
  }

  ctx.restore();
}
