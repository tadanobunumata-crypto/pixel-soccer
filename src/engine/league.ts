import type { Fixture, StandingRow, Team } from '../types';

// Circle method round-robin: n teams -> n-1 rounds, n/2 matches per round.
export function generateSchedule(teams: Team[]): Fixture[] {
  const ids = teams.map((t) => t.id);
  if (ids.length % 2 !== 0) ids.push('BYE');

  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  const fixtures: Fixture[] = [];

  const rotating = ids.slice(1);
  const fixed = ids[0];

  for (let round = 0; round < rounds; round++) {
    const roundTeams = [fixed, ...rotating];
    for (let i = 0; i < half; i++) {
      const a = roundTeams[i];
      const b = roundTeams[n - 1 - i];
      if (a === 'BYE' || b === 'BYE') continue;
      const homeFirst = round % 2 === 0;
      fixtures.push({
        round: round + 1,
        homeId: homeFirst ? a : b,
        awayId: homeFirst ? b : a,
      });
    }
    rotating.unshift(rotating.pop() as string);
  }

  return fixtures;
}

export function computeStandings(teams: Team[], fixtures: Fixture[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const t of teams) {
    rows.set(t.id, {
      teamId: t.id,
      played: 0,
      win: 0,
      draw: 0,
      lose: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    });
  }

  for (const fx of fixtures) {
    if (!fx.result) continue;
    const home = rows.get(fx.homeId)!;
    const away = rows.get(fx.awayId)!;
    const { homeScore, awayScore } = fx.result;

    home.played++;
    away.played++;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;

    if (homeScore > awayScore) {
      home.win++;
      home.points += 3;
      away.lose++;
    } else if (homeScore < awayScore) {
      away.win++;
      away.points += 3;
      home.lose++;
    } else {
      home.draw++;
      away.draw++;
      home.points += 1;
      away.points += 1;
    }
  }

  return [...rows.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}
