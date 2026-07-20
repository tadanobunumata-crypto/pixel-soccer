import type { MatchFrame } from '../engine/match';
import type { Team } from '../types';

export const PITCH_W = 200;
export const PITCH_H = 120;

interface Dot {
  x: number;
  y: number;
  isGK: boolean;
}

const DF_Y = [0.18, 0.38, 0.62, 0.82];
const MF_Y = [0.18, 0.38, 0.62, 0.82];
const FW_Y = [0.38, 0.62];

function baseFormation(): Dot[] {
  return [
    { x: 0.05, y: 0.5, isGK: true },
    ...DF_Y.map((y) => ({ x: 0.2, y, isGK: false })),
    ...MF_Y.map((y) => ({ x: 0.42, y, isGK: false })),
    ...FW_Y.map((y) => ({ x: 0.6, y, isGK: false })),
  ];
}

function formationFor(side: 'home' | 'away', frame: MatchFrame): Dot[] {
  const dots = baseFormation();
  let shift = 0;
  if (frame.possession === side) {
    shift = frame.phase === 'mid' ? 0.04 : frame.phase === 'attack' ? 0.14 : 0.22;
  } else if (frame.possession) {
    shift = -0.04;
  }

  return dots.map((d) => {
    const x = side === 'home' ? d.x + shift : 1 - (d.x + shift);
    return { x, y: d.y, isGK: d.isGK };
  });
}

function drawStripes(ctx: CanvasRenderingContext2D) {
  const stripeW = PITCH_W / 10;
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#2d8a3e' : '#279236';
    ctx.fillRect(i * stripeW, 0, stripeW, PITCH_H);
  }
}

function drawLines(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#f1faee';
  ctx.lineWidth = 1;

  ctx.strokeRect(4, 4, PITCH_W - 8, PITCH_H - 8);

  ctx.beginPath();
  ctx.moveTo(PITCH_W / 2, 4);
  ctx.lineTo(PITCH_W / 2, PITCH_H - 4);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(PITCH_W / 2, PITCH_H / 2, 14, 0, Math.PI * 2);
  ctx.stroke();

  // penalty boxes
  ctx.strokeRect(4, PITCH_H / 2 - 22, 22, 44);
  ctx.strokeRect(PITCH_W - 26, PITCH_H / 2 - 22, 22, 44);

  // goal mouths
  ctx.strokeRect(0, PITCH_H / 2 - 8, 4, 16);
  ctx.strokeRect(PITCH_W - 4, PITCH_H / 2 - 8, 4, 16);
}

export function drawPitchBackground(ctx: CanvasRenderingContext2D) {
  drawStripes(ctx);
  drawLines(ctx);
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: MatchFrame,
  home: Team,
  away: Team,
) {
  ctx.clearRect(0, 0, PITCH_W, PITCH_H);
  drawPitchBackground(ctx);

  const drawDots = (dots: Dot[], color: string) => {
    for (const d of dots) {
      const px = d.x * PITCH_W;
      const py = d.y * PITCH_H;
      ctx.fillStyle = d.isGK ? '#ffe066' : color;
      ctx.fillRect(Math.round(px) - 2, Math.round(py) - 2, 4, 4);
    }
  };

  drawDots(formationFor('away', frame), away.color);
  drawDots(formationFor('home', frame), home.color);

  const bx = frame.ballX * PITCH_W;
  const by = frame.ballY * PITCH_H;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 3);
  ctx.fillStyle = '#1d1d1d';
  ctx.fillRect(Math.round(bx), Math.round(by), 1, 1);

  if (frame.phase === 'goal') {
    ctx.fillStyle = 'rgba(255, 214, 10, 0.35)';
    ctx.fillRect(0, 0, PITCH_W, PITCH_H);
  }
}
