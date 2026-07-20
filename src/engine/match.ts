import type { MatchEvent, MatchResult, Team } from '../types';
import { mulberry32 } from './rng';
import { goalkeeperRating, teamAttackRating, teamDefenseRating } from './ratings';

export type Side = 'home' | 'away';

export interface MatchFrame {
  minute: number;
  ballX: number; // 0..1 across the pitch length
  ballY: number; // 0..1 across the pitch width
  possession: Side | null;
  phase: 'mid' | 'attack' | 'shot' | 'goal';
}

export interface SimulatedMatch {
  result: MatchResult;
  frames: MatchFrame[];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function pickAttacker(team: Team, rng: () => number) {
  const pool = team.players.filter((p) => p.position === 'FW' || p.position === 'MF');
  return pool[Math.floor(rng() * pool.length)] ?? team.players[0];
}

export function simulateMatch(home: Team, away: Team, seed: number): SimulatedMatch {
  const rng = mulberry32(seed);

  const homeAttack = teamAttackRating(home);
  const awayAttack = teamAttackRating(away);
  const homeDefense = teamDefenseRating(home);
  const awayDefense = teamDefenseRating(away);
  const homeGk = goalkeeperRating(home);
  const awayGk = goalkeeperRating(away);

  let homeScore = 0;
  let awayScore = 0;
  const events: MatchEvent[] = [
    { minute: 0, kind: 'kickoff', text: `キックオフ！ ${home.name} vs ${away.name}` },
  ];
  const frames: MatchFrame[] = [];

  let lastPossession: Side = rng() > 0.5 ? 'home' : 'away';

  for (let minute = 1; minute <= 90; minute++) {
    // possession has inertia: usually keeps flowing to the same side as last minute
    const homeWeight = homeAttack + 20 * (lastPossession === 'home' ? 1 : 0);
    const awayWeight = awayAttack + 20 * (lastPossession === 'away' ? 1 : 0);
    const possession: Side = rng() * (homeWeight + awayWeight) < homeWeight ? 'home' : 'away';
    lastPossession = possession;

    const attackTeam = possession === 'home' ? home : away;
    const attackRating = possession === 'home' ? homeAttack : awayAttack;
    const defenseRating = possession === 'home' ? awayDefense : homeDefense;
    const gkRating = possession === 'home' ? awayGk : homeGk;

    const attackChance = clamp01(0.16 + (attackRating - defenseRating) / 300);

    if (rng() < attackChance) {
      const scorer = pickAttacker(attackTeam, rng);
      const shotChance = clamp01(0.4 + (scorer.technique - 50) / 250);

      if (rng() < shotChance) {
        const shotPower = scorer.attack * 0.6 + scorer.technique * 0.4 + (rng() - 0.5) * 30;
        const savePower = gkRating + (rng() - 0.5) * 30;
        const blockPower = defenseRating + (rng() - 0.5) * 25;

        if (shotPower > savePower && shotPower > blockPower) {
          if (possession === 'home') homeScore++;
          else awayScore++;
          events.push({
            minute,
            kind: 'goal',
            side: possession,
            text: `⚽ ゴール！ ${attackTeam.shortName} の ${scorer.name} が決めた！ (${homeScore}-${awayScore})`,
          });
          frames.push({ minute, ballX: possession === 'home' ? 0.92 : 0.08, ballY: 0.5, possession, phase: 'goal' });
        } else if (shotPower > blockPower) {
          events.push({
            minute,
            kind: 'save',
            side: possession,
            text: `${scorer.name} のシュート、相手GKのファインセーブ！`,
          });
          frames.push({ minute, ballX: possession === 'home' ? 0.85 : 0.15, ballY: 0.5, possession, phase: 'shot' });
        } else {
          events.push({
            minute,
            kind: rng() < 0.5 ? 'block' : 'miss',
            side: possession,
            text: `${scorer.name} のシュートは枠を外れた`,
          });
          frames.push({ minute, ballX: possession === 'home' ? 0.8 : 0.2, ballY: 0.5, possession, phase: 'shot' });
        }
      } else {
        events.push({
          minute,
          kind: 'chance',
          side: possession,
          text: `${attackTeam.shortName} が攻め込むが、最後は相手に阻まれる`,
        });
        frames.push({
          minute,
          ballX: possession === 'home' ? 0.7 : 0.3,
          ballY: clamp01(0.5 + (rng() - 0.5) * 0.6),
          possession,
          phase: 'attack',
        });
      }
    } else {
      frames.push({
        minute,
        ballX: clamp01(0.5 + (rng() - 0.5) * 0.3),
        ballY: clamp01(0.5 + (rng() - 0.5) * 0.5),
        possession,
        phase: 'mid',
      });
    }

    if (minute === 45) {
      events.push({ minute, kind: 'halftime', text: `前半終了 (${homeScore}-${awayScore})` });
    }
  }

  events.push({ minute: 90, kind: 'fulltime', text: `試合終了 ${home.name} ${homeScore}-${awayScore} ${away.name}` });

  return {
    result: {
      homeId: home.id,
      awayId: away.id,
      homeScore,
      awayScore,
      events,
    },
    frames,
  };
}
