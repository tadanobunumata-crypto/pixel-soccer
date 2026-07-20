import { mulberry32 } from '../engine/rng';
import type { Position } from '../types';

export interface PositionSample {
  ballX: number;
  ballY: number;
  dx: number; // player x - ball x, in the "own goal at x=0" reference frame
  dy: number; // player y - ball y
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Approximate real team-shape principles relative to the ball, per role:
// - the defensive line holds a height that rises as the ball advances (offside trap)
// - midfield mirrors the ball's progress closely
// - forwards stay high, dropping only when the ball is deep in the own half
// - all lines compress laterally toward the ball's side of the pitch
const BASE_X: Record<Position, (ballX: number) => number> = {
  GK: (bx) => 0.05 + 0.08 * bx,
  DF: (bx) => clamp01(0.16 + 0.42 * bx),
  MF: (bx) => clamp01(0.28 + 0.48 * bx),
  FW: (bx) => clamp01(0.55 + 0.35 * bx),
};

const Y_PULL: Record<Position, number> = {
  GK: 0.35,
  DF: 0.4,
  MF: 0.6,
  FW: 0.3,
};

const NOISE: Record<Position, number> = {
  GK: 0.015,
  DF: 0.03,
  MF: 0.035,
  FW: 0.035,
};

const SEEDS: Record<Position, number> = { GK: 11, DF: 22, MF: 33, FW: 44 };

function buildSamples(position: Position): PositionSample[] {
  const rng = mulberry32(SEEDS[position]);
  const samples: PositionSample[] = [];
  const xs = [0.08, 0.2, 0.35, 0.5, 0.65, 0.8, 0.92];
  const ys = [0.12, 0.3, 0.5, 0.7, 0.88];

  for (const bx of xs) {
    for (const by of ys) {
      const px = clamp01(BASE_X[position](bx) + (rng() - 0.5) * NOISE[position]);
      const py = clamp01(0.5 + (by - 0.5) * Y_PULL[position] + (rng() - 0.5) * NOISE[position]);
      samples.push({ ballX: bx, ballY: by, dx: px - bx, dy: py - by });
    }
  }
  return samples;
}

export const POSITION_SAMPLES: Record<Position, PositionSample[]> = {
  GK: buildSamples('GK'),
  DF: buildSamples('DF'),
  MF: buildSamples('MF'),
  FW: buildSamples('FW'),
};
