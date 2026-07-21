// Small procedural pixel-art humanoid, built from primitive shapes rather
// than a sprite sheet. Scale shrinks with distance from the camera (see
// projection.ts) and legs animate for running / kicking poses.

export function drawPerson(
  ctx: CanvasRenderingContext2D,
  groundX: number,
  groundY: number,
  scale: number,
  shirtColor: string,
  facing: 1 | -1,
  runPhase: number,
  kicking: boolean,
) {
  const s = Math.max(0.4, scale);
  const legH = 4 * s;
  const bodyH = 5 * s;
  const bodyW = 4.2 * s;
  const headR = 1.7 * s;

  const bodyBottom = groundY - legH * 0.4;
  const bodyTop = bodyBottom - bodyH;
  const headCenterY = bodyTop - headR * 0.8;

  ctx.fillStyle = '#232323';
  if (kicking) {
    const kickLen = 5.5 * s * facing;
    ctx.fillRect(groundX - bodyW * 0.32, bodyBottom - legH, Math.max(1, bodyW * 0.3), legH);
    ctx.fillRect(groundX, bodyBottom - legH * 0.65, kickLen, Math.max(1, bodyW * 0.28));
  } else {
    const swing = Math.sin(runPhase * Math.PI * 2) * 1.8 * s;
    ctx.fillRect(groundX - bodyW * 0.3 + swing * 0.5, bodyBottom - legH, Math.max(1, bodyW * 0.26), legH);
    ctx.fillRect(groundX + bodyW * 0.04 - swing * 0.5, bodyBottom - legH, Math.max(1, bodyW * 0.26), legH);
  }

  ctx.fillStyle = shirtColor;
  ctx.fillRect(groundX - bodyW / 2, bodyTop, bodyW, bodyH);

  ctx.fillStyle = '#f0c090';
  ctx.beginPath();
  ctx.arc(groundX, headCenterY, headR, 0, Math.PI * 2);
  ctx.fill();
}

export function drawBallShadow(ctx: CanvasRenderingContext2D, groundX: number, groundY: number, scale: number) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(groundX, groundY, 2.6 * scale, 1 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawBall(ctx: CanvasRenderingContext2D, sx: number, sy: number, scale: number) {
  const r = Math.max(1, 1.6 * scale);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d1d1d';
  ctx.beginPath();
  ctx.arc(sx, sy - r * 0.2, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}
