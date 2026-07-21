import { TEAMS, getTeam } from '../data/teams';
import { generateSchedule, computeStandings } from '../engine/league';
import { simulateMatch, type ActionKind } from '../engine/match';
import { teamOverallRating } from '../engine/ratings';
import type { Fixture, StandingRow, Team } from '../types';
import { drawFrame, drawReplayFrame, PITCH_H, PITCH_W } from '../render/pitch';
import { REPLAY_FPS, REPLAY_FRAMES } from '../data/replaySample';

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

  const replayBtn = el('button', 'secondary', '実データ再生モード');
  replayBtn.style.marginLeft = '10px';
  replayBtn.onclick = () => renderReplay();
  wrap.appendChild(replayBtn);

  root.appendChild(wrap);
}

// ---------- Real-data replay mode ----------

let replayAnimationHandle: number | undefined;

function renderReplay() {
  if (replayAnimationHandle) cancelAnimationFrame(replayAnimationHandle);
  root.innerHTML = '';

  root.appendChild(el('h2', undefined, '実データ再生モード'));
  root.appendChild(
    el(
      'p',
      undefined,
      'Metrica Sports の公開サンプルトラッキングデータ（匿名化済み実試合、前半5分間）をモデルを介さずそのまま再生します。',
    ),
  );

  const scoreboard = el('div', 'scoreboard');
  const homeLabel = el('span', undefined, 'チームA(赤)');
  const timeLabel = el('span', undefined, '0:00');
  const awayLabel = el('span', undefined, 'チームB(青)');
  scoreboard.append(homeLabel, timeLabel, awayLabel);
  root.appendChild(scoreboard);

  const canvas = document.createElement('canvas');
  canvas.id = 'pitch';
  canvas.width = PITCH_W;
  canvas.height = PITCH_H;
  root.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const controls = el('div', 'controls');
  const backBtn = el('button', 'secondary', 'タイトルへ戻る');
  backBtn.onclick = () => {
    if (replayAnimationHandle) cancelAnimationFrame(replayAnimationHandle);
    renderTitle();
  };
  controls.appendChild(backBtn);
  root.appendChild(controls);

  const frameDurationMs = 1000 / REPLAY_FPS;
  const totalFrames = REPLAY_FRAMES.length;
  let startTimestamp: number | undefined;

  const tick = (now: number) => {
    if (startTimestamp === undefined) startTimestamp = now;
    const elapsedFrames = ((now - startTimestamp) / frameDurationMs) % totalFrames;
    const k = Math.floor(elapsedFrames);
    const t = elapsedFrames - k;
    const kNext = (k + 1) % totalFrames;

    const from = REPLAY_FRAMES[k];
    const to = REPLAY_FRAMES[kNext];
    const lerpPair = (a: [number, number], b: [number, number]): [number, number] => [
      lerp(a[0], b[0], t),
      lerp(a[1], b[1], t),
    ];

    drawReplayFrame(
      ctx,
      lerpPair(from.ball, to.ball),
      from.home.map((p, i) => lerpPair(p, to.home[i] ?? p)),
      from.away.map((p, i) => lerpPair(p, to.away[i] ?? p)),
      (now / 220) % 1,
    );

    const seconds = Math.floor(k / REPLAY_FPS);
    timeLabel.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

    replayAnimationHandle = requestAnimationFrame(tick);
  };

  replayAnimationHandle = requestAnimationFrame(tick);
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

let activeAnimationHandle: number | undefined;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function durationFor(kind: ActionKind): number {
  if (kind === 'shot') return 650;
  if (kind === 'pass') return 480;
  return 420; // dribble
}

function startMatch(fixture: Fixture) {
  if (!state) return;
  const home = getTeam(fixture.homeId);
  const away = getTeam(fixture.awayId);
  const seed = state.round * 10000 + fixture.homeId.length * 97 + fixture.awayId.length * 13 + Date.now() % 1000;
  const { result, timeline } = simulateMatch(home, away, seed);

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

  // Renders one micro-event segment (a dribble run, a pass, or a shot) at
  // progress t (0..1): the ball moves from -> to with a parabolic arc for
  // its height, and player positions follow from the ball position (see
  // engine/positioning.ts), so they move smoothly along with it.
  const renderSegment = (segIndex: number, t: number, animT: number) => {
    const seg = timeline[Math.min(segIndex, timeline.length - 1)];
    const ballX = lerp(seg.fromX, seg.toX, t);
    const ballY = lerp(seg.fromY, seg.toY, t);
    const ballZ = seg.peakHeight * 4 * t * (1 - t);
    const kicking = seg.kind !== 'dribble' && t < 0.3;
    const goalFlash = seg.kind === 'shot' && seg.outcome === 'goal' && t > 0.55;

    drawFrame(ctx, { ballX, ballY, ballZ, side: seg.side, kicking, goalFlash }, home, away, animT);
    minuteLabel.textContent = `${seg.minute}'`;
  };

  const finishPlayback = () => {
    if (activeAnimationHandle) cancelAnimationFrame(activeAnimationHandle);
    activeAnimationHandle = undefined;
    renderSegment(timeline.length - 1, 1, 0);
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

  let segIndex = 0;
  let segStart: number | undefined;

  const tick = (now: number) => {
    if (segIndex >= timeline.length) {
      finishPlayback();
      return;
    }
    if (segStart === undefined) segStart = now;
    const seg = timeline[segIndex];
    const duration = durationFor(seg.kind);
    const t = Math.min(1, (now - segStart) / duration);

    renderSegment(segIndex, t, (now / 220) % 1);

    if (t >= 1) {
      const next = timeline[segIndex + 1];
      if (!next || next.minute !== seg.minute) processEventsUpTo(seg.minute);
      segIndex++;
      segStart = now;
    }

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
