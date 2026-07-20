// Builds src/data/positioningSamples.ts from Metrica Sports raw tracking CSVs.
//
// Source data (not included in this repo — download separately):
//   https://github.com/metrica-sports/sample-data
//   data/Sample_Game_1/Sample_Game_1_RawTrackingData_Home_Team.csv
//   data/Sample_Game_1/Sample_Game_1_RawTrackingData_Away_Team.csv
// Anonymized real match tracking data, used here per the source repo's terms
// (please acknowledge Metrica Sports if you redistribute anything derived from it).
//
// Usage:
//   node scripts/buildPositioningData.mjs <home.csv> <away.csv> src/data/positioningSamples.ts
//
// Method: only Period 1 is used (avoids the half-time end-swap). Each player's
// average x position over the period identifies their role — the most extreme
// player is the goalkeeper, the four deepest outfielders are defenders, the two
// most advanced are forwards, the rest are midfielders — and also tells us which
// goal that team defends, so positions can be re-expressed in an "own goal at
// x=0" frame. For every tracking frame, each player's position relative to the
// ball is computed and averaged into a coarse (ballX, ballY) grid per role,
// producing a compact set of real-data-derived samples for the game to train on.

import fs from 'node:fs';

const [, , homePath, awayPath, outPath] = process.argv;
if (!homePath || !awayPath || !outPath) {
  console.error('Usage: node buildPositioningData.mjs <home.csv> <away.csv> <output.ts>');
  process.exit(1);
}

function parseTeamCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r/g, '');
  const lines = text.split('\n').filter((l) => l.length > 0);
  const header = lines[2].split(',');

  const playerCols = [];
  for (let i = 3; i < header.length; i++) {
    const name = header[i];
    if (!name) continue;
    playerCols.push({ name, xIdx: i, yIdx: i + 1 });
    i += 1;
  }
  const ballCol = playerCols.find((c) => c.name === 'Ball');
  const players = playerCols.filter((c) => c.name !== 'Ball');

  const rows = [];
  for (let li = 3; li < lines.length; li++) {
    const cols = lines[li].split(',');
    if (Number(cols[0]) !== 1) continue; // Period 1 only
    const bx = Number(cols[ballCol.xIdx]);
    const by = Number(cols[ballCol.yIdx]);
    if (!Number.isFinite(bx) || !Number.isFinite(by)) continue;
    rows.push({
      bx,
      by,
      playerPos: players.map((p) => ({ name: p.name, x: Number(cols[p.xIdx]), y: Number(cols[p.yIdx]) })),
    });
  }
  return { players: players.map((p) => p.name), rows };
}

function classifyRoles(players, rows) {
  const sums = new Map(players.map((name) => [name, { sumX: 0, count: 0 }]));
  for (const row of rows) {
    for (const p of row.playerPos) {
      if (!Number.isFinite(p.x)) continue;
      const s = sums.get(p.name);
      s.sumX += p.x;
      s.count += 1;
    }
  }

  const qualifying = players
    .map((name) => ({ name, ...sums.get(name) }))
    .filter((s) => s.count > 1000)
    .map((s) => ({ name: s.name, meanX: s.sumX / s.count }));

  let gk = qualifying[0];
  for (const q of qualifying) {
    if (Math.min(q.meanX, 1 - q.meanX) < Math.min(gk.meanX, 1 - gk.meanX)) gk = q;
  }
  const ownGoalSide = gk.meanX < 0.5 ? 0 : 1;

  const outfield = qualifying
    .filter((q) => q.name !== gk.name)
    .map((q) => ({ ...q, relX: ownGoalSide === 0 ? q.meanX : 1 - q.meanX }))
    .sort((a, b) => a.relX - b.relX);

  return {
    ownGoalSide,
    gk: gk.name,
    df: outfield.slice(0, 4).map((q) => q.name),
    fw: outfield.slice(-2).map((q) => q.name),
    mf: outfield.slice(4, Math.max(4, outfield.length - 2)).map((q) => q.name),
  };
}

function buildSamples(rows, roles) {
  const buckets = { GK: [roles.gk], DF: roles.df, MF: roles.mf, FW: roles.fw };
  const bins = new Map();

  for (const row of rows) {
    const ballXRel = roles.ownGoalSide === 0 ? row.bx : 1 - row.bx;
    const ballYRel = row.by;

    for (const [role, names] of Object.entries(buckets)) {
      for (const p of row.playerPos) {
        if (!names.includes(p.name) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        const pxRel = roles.ownGoalSide === 0 ? p.x : 1 - p.x;
        const dx = pxRel - ballXRel;
        const dy = p.y - ballYRel;
        const bxBin = Math.round(ballXRel * 10) / 10;
        const byBin = Math.round(ballYRel * 5) / 5;
        const key = `${role}|${bxBin}|${byBin}`;
        if (!bins.has(key)) bins.set(key, { role, bxBin, byBin, sumDx: 0, sumDy: 0, count: 0 });
        const b = bins.get(key);
        b.sumDx += dx;
        b.sumDy += dy;
        b.count += 1;
      }
    }
  }

  const samples = { GK: [], DF: [], MF: [], FW: [] };
  for (const b of bins.values()) {
    if (b.count < 20) continue;
    samples[b.role].push({
      ballX: b.bxBin,
      ballY: b.byBin,
      dx: Number((b.sumDx / b.count).toFixed(4)),
      dy: Number((b.sumDy / b.count).toFixed(4)),
    });
  }
  return samples;
}

function merge(a, b) {
  return { GK: [...a.GK, ...b.GK], DF: [...a.DF, ...b.DF], MF: [...a.MF, ...b.MF], FW: [...a.FW, ...b.FW] };
}

const home = parseTeamCsv(homePath);
const away = parseTeamCsv(awayPath);
const homeRoles = classifyRoles(home.players, home.rows);
const awayRoles = classifyRoles(away.players, away.rows);

console.log('Home roles:', homeRoles);
console.log('Away roles:', awayRoles);

const merged = merge(buildSamples(home.rows, homeRoles), buildSamples(away.rows, awayRoles));
for (const role of ['GK', 'DF', 'MF', 'FW']) {
  console.log(role, merged[role].length, 'samples');
}

const out = `// Auto-generated by scripts/buildPositioningData.mjs from Metrica Sports
// sample tracking data (Sample Game 1, Period 1) — see that script for the
// source URL, license notes, and how to regenerate this file.
import type { Position } from '../types';

export interface PositionSample {
  ballX: number;
  ballY: number;
  dx: number;
  dy: number;
}

export const POSITION_SAMPLES: Record<Position, PositionSample[]> = ${JSON.stringify(merged, null, 2)};
`;

fs.writeFileSync(outPath, out, 'utf8');
console.log('Wrote', outPath);
