import { predictOffset } from '../engine/positioning';
import type { Side } from '../engine/match';
import type { Position, Team } from '../types';
import { project, projectPoint, VIEW_H, VIEW_W } from './projection';
import { drawBall, drawBallShadow, drawPerson } from './sprite';

export { VIEW_W as PITCH_W, VIEW_H as PITCH_H } from './projection';

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
function formationFor(side: Side, ballX: number, ballY: number): Dot[] {
  // Work in a reference frame where this side's own goal sits at x=0.
  const ballXRel = side === 'home' ? ballX : 1 - ballX;
  const ballYRel = ballY;

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

function drawPitchBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#0b2412';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const stripes = 10;
  for (let i = 0; i < stripes; i++) {
    const x0 = i / stripes;
    const x1 = (i + 1) / stripes;
    const p0 = projectPoint(x0, 0);
    const p1 = projectPoint(x1, 0);
    const p2 = projectPoint(x1, 1);
    const p3 = projectPoint(x0, 1);
    ctx.fillStyle = i % 2 === 0 ? '#2d8a3e' : '#279236';
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = '#f1faee';
  ctx.lineWidth = 1;

  const corners = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ].map(([x, y]) => projectPoint(x, y));
  ctx.beginPath();
  corners.forEach(([sx, sy], i) => (i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy)));
  ctx.closePath();
  ctx.stroke();

  const [hx0, hy0] = projectPoint(0.5, 0);
  const [hx1, hy1] = projectPoint(0.5, 1);
  ctx.beginPath();
  ctx.moveTo(hx0, hy0);
  ctx.lineTo(hx1, hy1);
  ctx.stroke();

  const centerProj = project(0.5, 0.5);
  const rx = 22 * centerProj.scale;
  const ry = rx * 0.5;
  ctx.beginPath();
  ctx.ellipse(centerProj.sx, centerProj.sy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  const drawBox = (xEdge: number, dir: 1 | -1) => {
    const depth = 0.16 * dir;
    const pts = [
      [xEdge, 0.26],
      [xEdge + depth, 0.26],
      [xEdge + depth, 0.74],
      [xEdge, 0.74],
    ].map(([x, y]) => projectPoint(x, y));
    ctx.beginPath();
    pts.forEach(([sx, sy], i) => (i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy)));
    ctx.closePath();
    ctx.stroke();
  };
  drawBox(0, 1);
  drawBox(1, -1);

  const drawGoal = (xEdge: number) => {
    const top = projectPoint(xEdge, 0.46);
    const bottom = projectPoint(xEdge, 0.54);
    ctx.beginPath();
    ctx.moveTo(top[0], top[1] - 7);
    ctx.lineTo(top[0], top[1]);
    ctx.lineTo(bottom[0], bottom[1]);
    ctx.lineTo(bottom[0], bottom[1] - 7);
    ctx.stroke();
  };
  drawGoal(0);
  drawGoal(1);
}

export interface RenderState {
  ballX: number;
  ballY: number;
  ballZ: number;
  side: Side;
  kicking: boolean;
  goalFlash: boolean;
}

interface Drawable {
  depth: number;
  draw: () => void;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  home: Team,
  away: Team,
  animT: number,
) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawPitchBackground(ctx);

  const homeDots = formationFor('home', state.ballX, state.ballY);
  const awayDots = formationFor('away', state.ballX, state.ballY);

  const carrierSide = state.side;
  const carrierPool = carrierSide === 'home' ? homeDots : carrierSide === 'away' ? awayDots : [];
  let carrier: Dot | undefined;
  let bestDist = Infinity;
  for (const d of carrierPool) {
    const dist = Math.hypot(d.x - state.ballX, d.y - state.ballY);
    if (dist < bestDist) {
      bestDist = dist;
      carrier = d;
    }
  }

  const drawables: Drawable[] = [];

  const addTeam = (dots: Dot[], color: string, facing: 1 | -1) => {
    for (const d of dots) {
      const isCarrier = d === carrier;
      drawables.push({
        depth: d.y,
        draw: () => {
          const p = project(d.x, d.y, 0);
          drawPerson(
            ctx,
            p.sx,
            p.groundSy,
            p.scale,
            d.isGK ? '#ffe066' : color,
            facing,
            animT,
            isCarrier && state.kicking,
          );
        },
      });
    }
  };

  addTeam(homeDots, home.color, 1);
  addTeam(awayDots, away.color, -1);

  drawables.push({
    depth: state.ballY,
    draw: () => {
      const ground = project(state.ballX, state.ballY, 0);
      const lifted = project(state.ballX, state.ballY, state.ballZ);
      drawBallShadow(ctx, ground.sx, ground.groundSy, ground.scale);
      drawBall(ctx, lifted.sx, lifted.sy, lifted.scale);
    },
  });

  drawables.sort((a, b) => a.depth - b.depth);
  for (const item of drawables) item.draw();

  if (state.goalFlash) {
    ctx.fillStyle = 'rgba(255, 214, 10, 0.3)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

// Draws literal recorded positions (no positioning model involved) — used by
// the real-data replay screen. home/away are plain [x, y] coordinate pairs
// already in 0..1 pitch space.
export function drawReplayFrame(
  ctx: CanvasRenderingContext2D,
  ball: readonly [number, number],
  home: readonly (readonly [number, number])[],
  away: readonly (readonly [number, number])[],
  animT: number,
) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawPitchBackground(ctx);

  const drawables: Drawable[] = [];
  const addTeam = (players: readonly (readonly [number, number])[], color: string, facing: 1 | -1) => {
    for (const [x, y] of players) {
      drawables.push({
        depth: y,
        draw: () => {
          const p = project(x, y, 0);
          drawPerson(ctx, p.sx, p.groundSy, p.scale, color, facing, animT, false);
        },
      });
    }
  };
  addTeam(home, '#e63946', 1);
  addTeam(away, '#1d4ed8', -1);

  const [bx, by] = ball;
  drawables.push({
    depth: by,
    draw: () => {
      const p = project(bx, by, 0);
      drawBallShadow(ctx, p.sx, p.groundSy, p.scale);
      drawBall(ctx, p.sx, p.sy, p.scale);
    },
  });

  drawables.sort((a, b) => a.depth - b.depth);
  for (const item of drawables) item.draw();
}
