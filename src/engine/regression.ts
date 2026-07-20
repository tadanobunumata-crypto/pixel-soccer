export interface RegressionSample {
  x1: number;
  x2: number;
  target: number;
}

export interface LinearModel {
  w0: number;
  w1: number;
  w2: number;
  predict(x1: number, x2: number): number;
}

function solve3x3(a: number[][], b: number[]): number[] {
  const m = a.map((row, i) => [...row, b[i]]);
  const n = 3;

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const pivotVal = m[col][col] || 1e-9;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row][col] / pivotVal;
      for (let k = col; k <= n; k++) {
        m[row][k] -= factor * m[col][k];
      }
    }
  }

  return [0, 1, 2].map((i) => m[i][n] / (m[i][i] || 1e-9));
}

// Ordinary least squares fit for target ≈ w0 + w1*x1 + w2*x2, solved via the
// normal equations (X^T X) w = X^T y. This is the "learning" step: coefficients
// are derived from the sample data rather than hand-tuned.
export function fitLinearModel(samples: RegressionSample[]): LinearModel {
  let sumX1 = 0;
  let sumX2 = 0;
  let sumX1X1 = 0;
  let sumX2X2 = 0;
  let sumX1X2 = 0;
  let sumY = 0;
  let sumX1Y = 0;
  let sumX2Y = 0;
  const n = samples.length;

  for (const s of samples) {
    sumX1 += s.x1;
    sumX2 += s.x2;
    sumX1X1 += s.x1 * s.x1;
    sumX2X2 += s.x2 * s.x2;
    sumX1X2 += s.x1 * s.x2;
    sumY += s.target;
    sumX1Y += s.x1 * s.target;
    sumX2Y += s.x2 * s.target;
  }

  const a = [
    [n, sumX1, sumX2],
    [sumX1, sumX1X1, sumX1X2],
    [sumX2, sumX1X2, sumX2X2],
  ];
  const b = [sumY, sumX1Y, sumX2Y];
  const [w0, w1, w2] = solve3x3(a, b);

  return {
    w0,
    w1,
    w2,
    predict(x1: number, x2: number) {
      return w0 + w1 * x1 + w2 * x2;
    },
  };
}
