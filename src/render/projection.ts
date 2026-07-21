// Pseudo-3D "elevated side view" projection: the camera sits high up on one
// side of the pitch, looking across its width, so the far touchline (y=0)
// renders compressed near a horizon line and the near touchline (y=1) fills
// the bottom of the view — a classic trapezoid pitch look. Player/ball height
// (z) lifts the sprite up the screen relative to its ground position.

export const VIEW_W = 240;
export const VIEW_H = 130;

const HORIZON_Y = 14;
const NEAR_Y = 118;
const SIDE_MARGIN = 14;
const FAR_WIDTH_RATIO = 0.58;
const HEIGHT_PX_PER_UNIT = 30;

export interface Projected {
  sx: number;
  sy: number;
  groundSy: number;
  scale: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// x: 0..1 along the pitch length. y: 0 (far touchline) .. 1 (near touchline).
// z: height above the ground (0 = grounded), same rough scale as x/y.
export function project(x: number, y: number, z = 0): Projected {
  const depth = clamp01(y);
  const groundSy = HORIZON_Y + depth * (NEAR_Y - HORIZON_Y);
  const scale = FAR_WIDTH_RATIO + (1 - FAR_WIDTH_RATIO) * depth;
  const halfWidth = (VIEW_W / 2 - SIDE_MARGIN) * scale;
  const sx = VIEW_W / 2 + (x - 0.5) * 2 * halfWidth;
  const sy = groundSy - z * HEIGHT_PX_PER_UNIT * scale;
  return { sx, sy, groundSy, scale };
}

export function projectPoint(x: number, y: number): [number, number] {
  const p = project(x, y, 0);
  return [p.sx, p.sy];
}
