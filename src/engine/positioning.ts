import { POSITION_SAMPLES } from '../data/positioningSamples';
import type { Position } from '../types';
import { fitLinearModel, type LinearModel } from './regression';

interface RoleModel {
  dx: LinearModel;
  dy: LinearModel;
}

function trainRole(position: Position): RoleModel {
  const samples = POSITION_SAMPLES[position];
  return {
    dx: fitLinearModel(samples.map((s) => ({ x1: s.ballX, x2: s.ballY, target: s.dx }))),
    dy: fitLinearModel(samples.map((s) => ({ x1: s.ballX, x2: s.ballY, target: s.dy }))),
  };
}

// Trained once at module load from POSITION_SAMPLES — the model learns each
// role's typical offset from the ball rather than following a per-frame script.
const MODELS: Record<Position, RoleModel> = {
  GK: trainRole('GK'),
  DF: trainRole('DF'),
  MF: trainRole('MF'),
  FW: trainRole('FW'),
};

export function predictOffset(position: Position, ballX: number, ballY: number): { dx: number; dy: number } {
  const model = MODELS[position];
  return {
    dx: model.dx.predict(ballX, ballY),
    dy: model.dy.predict(ballX, ballY),
  };
}
