import type { Player, Position, Team } from '../types';
import { mulberry32, randInt } from '../engine/rng';
import { randomPlayerName } from './names';

interface TeamSeed {
  id: string;
  name: string;
  shortName: string;
  color: string;
  seed: number;
  strength: number; // base overall strength 1-99, drives player attribute range
}

const TEAM_SEEDS: TeamSeed[] = [
  { id: 'blaze', name: 'FCブレイズ', shortName: 'BLZ', color: '#e63946', seed: 1, strength: 78 },
  { id: 'azul', name: 'アズールFC', shortName: 'AZL', color: '#1d4ed8', seed: 2, strength: 74 },
  { id: 'thunder', name: 'サンダーボルト東京', shortName: 'THT', color: '#f4a300', seed: 3, strength: 80 },
  { id: 'riverside', name: 'リバーサイドFC', shortName: 'RVS', color: '#2a9d8f', seed: 4, strength: 70 },
  { id: 'nova', name: 'ノヴァユナイテッド', shortName: 'NOV', color: '#7b2cbf', seed: 5, strength: 76 },
  { id: 'wolves', name: 'グリーンウルブズ', shortName: 'GRW', color: '#3a5a40', seed: 6, strength: 72 },
  { id: 'starlight', name: 'スターライトFC', shortName: 'STL', color: '#ffd60a', seed: 7, strength: 68 },
  { id: 'eagles', name: 'イーグルスFC', shortName: 'EGL', color: '#495057', seed: 8, strength: 75 },
];

const FORMATION: Position[] = [
  'GK',
  'DF', 'DF', 'DF', 'DF',
  'MF', 'MF', 'MF', 'MF',
  'FW', 'FW',
];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function buildPlayer(id: string, position: Position, strength: number, rng: () => number): Player {
  const spread = 14;
  const base = () => clamp(Math.round(strength + randInt(rng, -spread, spread)), 30, 99);

  const attributes = {
    attack: base(),
    defense: base(),
    speed: base(),
    technique: base(),
    stamina: base(),
  };

  if (position === 'FW') {
    attributes.attack = clamp(attributes.attack + 10, 30, 99);
  } else if (position === 'MF') {
    attributes.technique = clamp(attributes.technique + 8, 30, 99);
  } else if (position === 'DF') {
    attributes.defense = clamp(attributes.defense + 10, 30, 99);
  } else if (position === 'GK') {
    attributes.defense = clamp(attributes.defense + 15, 30, 99);
  }

  return {
    id,
    name: randomPlayerName(rng),
    position,
    ...attributes,
  };
}

function buildTeam(seed: TeamSeed): Team {
  const rng = mulberry32(seed.seed * 1000 + 7);
  const players = FORMATION.map((pos, i) => buildPlayer(`${seed.id}-${i}`, pos, seed.strength, rng));
  return {
    id: seed.id,
    name: seed.name,
    shortName: seed.shortName,
    color: seed.color,
    players,
  };
}

export const TEAMS: Team[] = TEAM_SEEDS.map(buildTeam);

export function getTeam(id: string): Team {
  const team = TEAMS.find((t) => t.id === id);
  if (!team) throw new Error(`Unknown team id: ${id}`);
  return team;
}
