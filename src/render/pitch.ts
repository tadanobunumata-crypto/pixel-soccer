import type { MatchFrame } from '../engine/match';
import { predictOffset } from '../engine/positioning';
import type { Position, Team } from '../types';

export const PITCH_W = 200;
export const PITCH_H = 120;

interface Dot {
  x: number;
  y: number;
  isGK: boolean;
}

// Lateral spread of teammates around the role's learned center position.
const DF_LANES = [-0.32, -0.12, 0.12, 0.32];
const MF_LANES = [-0.32, -0.12, 0.12, 0.32];
const FW_LANES = [-0.12, 0.12];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function laneDots(position: Position, lanes: number[], ballXRel: number, ballYRel: number): Dot[] {
  const { dx, dy } = predictOffset(position, ballXRel, ballYRel);
  const centerX = clamp01(ballXRel + dx);
  const centerY = clamp01(ballYRel + dy);
  return lanes.map((lane) => ({ x: centerX, y: clamp01(centerY + lane), isGK: false }));
}

// Player positions are predicted from the ball position via a model learned
// (linear regression) from relative-position data per role — see
// engine/positioning.ts and data/positioningSamples.ts.
function formationFor(side: 'home' | 'away', frame: MatchFrame): Dot[] {
  // Work in a reference frame where this side's own goal sits at x=0.
  const ballXRel = side === 'home' ? frame.ballX : 1 - frame.ballX;
  const ballYRel = frame.ballY;

  const gkOffset = predictOffset('GK', ballXRel, ballYRel);
  const gk: Dot = {
    x: clamp01(ballXRel + gkOffset.dx),
    y: clamp01(ballYRel + gkOffset.dy),
    isGK: true,
  };

  const dots = [
    gk,
    ...laneDots('DF', DF_LANES, ballXRel, ballYRel),
    ...laneDots('MF', MF_LANES, ballXRel, ballYRel),
    ...laneDots('FW', FW_LANES, ballXRel, ballYRel),
  ];

  return dots.map((d) => ({
    x: side === 'home' ? d.x : 1 - d.x,
    y: d.y,
    isGK: d.isGK,
  }));
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
