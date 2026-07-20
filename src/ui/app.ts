import { TEAMS, getTeam } from '../data/teams';
import { generateSchedule, computeStandings } from '../engine/league';
import { simulateMatch, type MatchFrame } from '../engine/match';
import { teamOverallRating } from '../engine/ratings';
import type { Fixture, StandingRow, Team } from '../types';
import { drawFrame, PITCH_H, PITCH_W } from '../render/pitch';

interface GameState {
  fixtures: Fixture[];
  userTeamId: string;
  round: number; // next round to play, 1-indexed
  maxRound: number;
}

let state: GameState | null = null;
let root: HTMLElement;

export function startApp(container: HTMLElement) {
  root = container;
  renderTitle();
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------- Title ----------

function renderTitle() {
  root.innerHTML = '';
  const wrap = el('div', 'title-screen');
  wrap.appendChild(el('h1', undefined, 'ピクセルサッカー'));
  wrap.appendChild(el('p', undefined, 'カルチョビット風 2Dドット絵サッカーシミュレーション'));
  const startBtn = el('button', undefined, 'はじめる');
  startBtn.onclick = () => renderTeamSelect();
  wrap.appendChild(startBtn);
  root.appendChild(wrap);
}

// ---------- Team select ----------

function renderTeamSelect() {
  root.innerHTML = '';
  root.appendChild(el('h2', undefined, '自チームを選択'));

  const grid = el('div', 'team-grid');
  for (const team of TEAMS) {
    const card = el('div', 'team-card');
    const swatch = el('div', 'swatch');
    swatch.style.background = team.color;
    card.appendChild(swatch);
    card.appendChild(el('h3', undefined, team.name));
    card.appendChild(el('p', undefined, `総合力: ${Math.round(teamOverallRating(team))}`));
    card.onclick = () => confirmTeam(team);
    grid.appendChild(card);
  }
  root.appendChild(grid);
}

function confirmTeam(team: Team) {
  const fixtures = generateSchedule(TEAMS);
  const maxRound = Math.max(...fixtures.map((f) => f.round));
  state = {
    fixtures,
    userTeamId: team.id,
    round: 1,
    maxRound,
  };
  renderLeagueHome();
}

// ---------- League home ----------

function currentUserFixture(): Fixture | undefined {
  if (!state) return undefined;
  return state.fixtures.find(
    (f) => f.round === state!.round && (f.homeId === state!.userTeamId || f.awayId === state!.userTeamId),
  );
}

function renderStandingsTable(rows: StandingRow[]) {
  const table = el('table');
  const thead = el('thead');
  const headRow = el('tr');
  ['順位', 'チーム', '試', '勝', '分', '敗', '得', '失', '差', '点'].forEach((t) =>
    headRow.appendChild(el('th', undefined, t)),
  );
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el('tbody');
  rows.forEach((row, i) => {
    const team = getTeam(row.teamId);
    const tr = el('tr');
    if (team.id === state?.userTeamId) tr.classList.add('you');
    const gd = row.goalsFor - row.goalsAgainst;
    [
      String(i + 1),
      team.name,
      String(row.played),
      String(row.win),
      String(row.draw),
      String(row.lose),
      String(row.goalsFor),
      String(row.goalsAgainst),
      (gd > 0 ? '+' : '') + gd,
      String(row.points),
    ].forEach((t) => tr.appendChild(el('td', undefined, t)));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function renderLeagueHome() {
  if (!state) return;
  root.innerHTML = '';

  const userTeam = getTeam(state.userTeamId);
  root.appendChild(el('h2', undefined, `${userTeam.name} - シーズン戦績`));

  const standingsPanel = el('div', 'panel');
  root.appendChild(standingsPanel);

  if (state.round > state.maxRound) {
    renderSeasonEnd();
    return;
  }

  const fixture = currentUserFixture();
  const matchPanel = el('div', 'panel');
  matchPanel.appendChild(el('h3', undefined, `第${state.round}節`));

  if (fixture) {
    const home = getTeam(fixture.homeId);
    const away = getTeam(fixture.awayId);
    matchPanel.appendChild(
      el('div', 'fixture-line', `${home.name}  vs  ${away.name}`),
    );
    const playBtn = el('button', undefined, '試合開始');
    playBtn.onclick = () => startMatch(fixture);
    matchPanel.appendChild(playBtn);
  } else {
    matchPanel.appendChild(el('p', undefined, '今節は不戦（不参加）'));
    const nextBtn = el('button', undefined, '次節へ');
    nextBtn.onclick = () => {
      simulateOtherFixtures(state!.round);
      state!.round += 1;
      renderLeagueHome();
    };
    matchPanel.appendChild(nextBtn);
  }

  root.appendChild(matchPanel);

  const table = renderStandingsTable(computeStandings(TEAMS, state.fixtures));
  standingsPanel.innerHTML = '';
  standingsPanel.appendChild(el('h3', undefined, '順位表'));
  standingsPanel.appendChild(table);
}

function simulateOtherFixtures(round: number) {
  if (!state) return;
  const roundFixtures = state.fixtures.filter((f) => f.round === round && !f.result);
  for (const fx of roundFixtures) {
    if (fx.homeId === state.userTeamId || fx.awayId === state.userTeamId) continue;
    const home = getTeam(fx.homeId);
    const away = getTeam(fx.awayId);
    const seed = round * 10000 + fx.homeId.length * 97 + fx.awayId.length * 13 + Date.now() % 1000;
    const { result } = simulateMatch(home, away, seed);
    fx.result = result;
  }
}

// ---------- Match screen ----------

const MS_PER_SIMULATED_MINUTE = 130;
let activeAnimationHandle: number | undefined;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function startMatch(fixture: Fixture) {
  if (!state) return;
  const home = getTeam(fixture.homeId);
  const away = getTeam(fixture.awayId);
  const seed = state.round * 10000 + fixture.homeId.length * 97 + fixture.awayId.length * 13 + Date.now() % 1000;
  const { result, frames } = simulateMatch(home, away, seed);

  // resolve the rest of the round's fixtures instantly in the background
  simulateOtherFixtures(state.round);

  root.innerHTML = '';
  root.appendChild(el('h2', undefined, `第${state.round}節`));

  const scoreboard = el('div', 'scoreboard');
  const homeLabel = el('span', undefined, home.name);
  const scoreLabel = el('span', undefined, '0 - 0');
  const awayLabel = el('span', undefined, away.name);
  const minuteLabel = el('span', undefined, '0\'');
  scoreboard.append(homeLabel, minuteLabel, scoreLabel, awayLabel);
  root.appendChild(scoreboard);

  const canvas = document.createElement('canvas');
  canvas.id = 'pitch';
  canvas.width = PITCH_W;
  canvas.height = PITCH_H;
  root.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const commentary = el('div', 'commentary');
  root.appendChild(commentary);

  const controls = el('div', 'controls');
  const skipBtn = el('button', 'secondary', '早送り');
  controls.appendChild(skipBtn);
  root.appendChild(controls);

  let homeScore = 0;
  let awayScore = 0;
  let eventCursor = 0;

  // A synthetic kickoff frame (ball centered, minute 0) so the first minute
  // of play also has a start point to interpolate from.
  const timeline: MatchFrame[] = [
    { minute: 0, ballX: 0.5, ballY: 0.5, possession: null, phase: 'mid' },
    ...frames,
  ];

  const logLine = (text: string) => {
    const p = el('p', undefined, text);
    commentary.appendChild(p);
    commentary.scrollTop = commentary.scrollHeight;
  };

  const processEventsUpTo = (minute: number) => {
    while (eventCursor < result.events.length && result.events[eventCursor].minute <= minute) {
      const event = result.events[eventCursor];
      eventCursor++;
      logLine(event.text);
      if (event.kind === 'goal') {
        if (event.side === 'home') homeScore++;
        else awayScore++;
        scoreLabel.textContent = `${homeScore} - ${awayScore}`;
      }
    }
  };

  // Renders a smooth in-between position for any point in match time by
  // interpolating the ball between the two bracketing per-minute frames.
  // Player positions follow automatically since they're a function of the
  // ball position (see engine/positioning.ts).
  const renderAt = (minuteFloat: number) => {
    const clamped = Math.min(90, Math.max(0, minuteFloat));
    const k = Math.min(timeline.length - 2, Math.floor(clamped));
    const t = clamped - k;
    const from = timeline[k];
    const to = timeline[k + 1];
    const minuteFloor = Math.floor(clamped);

    drawFrame(
      ctx,
      {
        minute: minuteFloor,
        ballX: lerp(from.ballX, to.ballX, t),
        ballY: lerp(from.ballY, to.ballY, t),
        possession: to.possession,
        phase: to.phase,
      },
      home,
      away,
    );
    minuteLabel.textContent = `${minuteFloor}'`;
    processEventsUpTo(minuteFloor);
  };

  const finishPlayback = () => {
    if (activeAnimationHandle) cancelAnimationFrame(activeAnimationHandle);
    activeAnimationHandle = undefined;
    renderAt(90);
    processEventsUpTo(90);
    scoreLabel.textContent = `${result.homeScore} - ${result.awayScore}`;
    skipBtn.disabled = true;
    const doneBtn = el('button', undefined, '結果へ');
    doneBtn.onclick = () => {
      fixture.result = result;
      state!.round += 1;
      renderLeagueHome();
    };
    controls.appendChild(doneBtn);
  };

  let startTimestamp: number | undefined;
  const tick = (now: number) => {
    if (startTimestamp === undefined) startTimestamp = now;
    const elapsedMinutes = (now - startTimestamp) / MS_PER_SIMULATED_MINUTE;
    if (elapsedMinutes >= 90) {
      finishPlayback();
      return;
    }
    renderAt(elapsedMinutes);
    activeAnimationHandle = requestAnimationFrame(tick);
  };

  if (activeAnimationHandle) cancelAnimationFrame(activeAnimationHandle);
  activeAnimationHandle = requestAnimationFrame(tick);

  skipBtn.onclick = () => {
    finishPlayback();
  };
}

// ---------- Season end ----------

function renderSeasonEnd() {
  if (!state) return;
  root.innerHTML = '';
  const standings = computeStandings(TEAMS, state.fixtures);
  const champion = getTeam(standings[0].teamId);

  root.appendChild(el('h2', undefined, 'シーズン終了'));
  root.appendChild(el('div', 'champion', `🏆 優勝: ${champion.name}`));
  root.appendChild(renderStandingsTable(standings));

  const again = el('button', undefined, 'もう一度プレイ');
  again.onclick = () => {
    state = null;
    renderTitle();
  };
  root.appendChild(again);
}
