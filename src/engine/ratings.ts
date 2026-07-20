import type { Team } from '../types';

function avg(values: number[]): number {
  if (values.length === 0) return 50;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function teamAttackRating(team: Team): number {
  const attackers = team.players.filter((p) => p.position === 'FW' || p.position === 'MF');
  return avg(attackers.map((p) => p.attack * 0.6 + p.technique * 0.4));
}

export function teamDefenseRating(team: Team): number {
  const defenders = team.players.filter((p) => p.position === 'DF' || p.position === 'GK');
  return avg(defenders.map((p) => p.defense));
}

export function teamOverallRating(team: Team): number {
  return avg(team.players.map((p) => p.attack + p.defense + p.speed + p.technique + p.stamina)) / 5;
}

export function goalkeeperRating(team: Team): number {
  const gk = team.players.find((p) => p.position === 'GK');
  return gk ? gk.defense : 50;
}
