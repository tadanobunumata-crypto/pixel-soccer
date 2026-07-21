import type { MatchEvent, MatchResult, Team } from '../types';
import { mulberry32 } from './rng';
import { goalkeeperRating, teamAttackRating, teamDefenseRating } from './ratings';

export type Side = 'home' | 'away';
export type ActionKind = 'dribble' | 'pass' | 'shot';
export type ShotOutcome = 'goal' | 'save' | 'miss' | 'block';

// One ball-movement segment: from -> to over the segment's playback duration,
// arcing up to peakHeight and back down (0 = stays on the ground, as in a
// dribble or a short grounded pass).
export interface MicroEvent {
  minute: number;
  kind: ActionKind;
  side: Side;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  peakHeight: number;
  outcome?: ShotOutcome;
}

export interface SimulatedMatch {
  result: MatchResult;
  timeline: MicroEvent[];
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
  const timeline: MicroEvent[] = [];

  let lastPossession: Side = rng() > 0.5 ? 'home' : 'away';
  let prevX = 0.5;
  let prevY = 0.5;

  const moveTo = (minute: number, kind: ActionKind, side: Side, toX: number, toY: number, peakHeight: number) => {
    timeline.push({ minute, kind, side, fromX: prevX, fromY: prevY, toX, toY, peakHeight });
    prevX = toX;
    prevY = toY;
  };

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
      const buildKind: ActionKind = rng() < 0.5 ? 'dribble' : 'pass';
      const buildX = possession === 'home' ? 0.7 : 0.3;
      const buildY = clamp01(0.5 + (rng() - 0.5) * 0.6);
      moveTo(minute, buildKind, possession, buildX, buildY, buildKind === 'pass' ? 0.08 + rng() * 0.06 : 0);

      const scorer = pickAttacker(attackTeam, rng);
      const shotChance = clamp01(0.4 + (scorer.technique - 50) / 250);

      if (rng() < shotChance) {
        const shotPower = scorer.attack * 0.6 + scorer.technique * 0.4 + (rng() - 0.5) * 30;
        const savePower = gkRating + (rng() - 0.5) * 30;
        const blockPower = defenseRating + (rng() - 0.5) * 25;

        let outcome: ShotOutcome;
        let toX: number;
        let toY: number;
        let peakHeight: number;

        if (shotPower > savePower && shotPower > blockPower) {
          outcome = 'goal';
          toX = possession === 'home' ? 0.98 : 0.02;
          toY = clamp01(0.5 + (rng() - 0.5) * 0.16);
          peakHeight = 0.06 + rng() * 0.08;
          if (possession === 'home') homeScore++;
          else awayScore++;
          events.push({
            minute,
            kind: 'goal',
            side: possession,
            text: `⚽ ゴール！ ${attackTeam.shortName} の ${scorer.name} が決めた！ (${homeScore}-${awayScore})`,
          });
        } else if (shotPower > blockPower) {
          outcome = 'save';
          toX = possession === 'home' ? 0.88 : 0.12;
          toY = clamp01(0.5 + (rng() - 0.5) * 0.2);
          peakHeight = 0.1 + rng() * 0.1;
          events.push({
            minute,
            kind: 'save',
            side: possession,
            text: `${scorer.name} のシュート、相手GKのファインセーブ！`,
          });
        } else {
          outcome = rng() < 0.5 ? 'block' : 'miss';
          toX = possession === 'home' ? 0.85 : 0.15;
          toY = clamp01(0.5 + (rng() < 0.5 ? -1 : 1) * (0.22 + rng() * 0.18));
          peakHeight = 0.15 + rng() * 0.2;
          events.push({
            minute,
            kind: outcome,
            side: possession,
            text: `${scorer.name} のシュートは枠を外れた`,
          });
        }

        timeline.push({ minute, kind: 'shot', side: possession, fromX: prevX, fromY: prevY, toX, toY, peakHeight, outcome });
        prevX = 0.5;
        prevY = 0.5;
      } else {
        events.push({
          minute,
          kind: 'chance',
          side: possession,
          text: `${attackTeam.shortName} が攻め込むが、最後は相手に阻まれる`,
        });
        moveTo(
          minute,
          rng() < 0.5 ? 'dribble' : 'pass',
          possession === 'home' ? 'away' : 'home',
          clamp01(0.5 + (rng() - 0.5) * 0.2),
          clamp01(0.5 + (rng() - 0.5) * 0.4),
          0,
        );
      }
    } else {
      moveTo(
        minute,
        rng() < 0.6 ? 'dribble' : 'pass',
        possession,
        clamp01(0.5 + (rng() - 0.5) * 0.3),
        clamp01(0.5 + (rng() - 0.5) * 0.5),
        rng() < 0.4 ? 0.05 + rng() * 0.05 : 0,
      );
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
    timeline,
  };
}
