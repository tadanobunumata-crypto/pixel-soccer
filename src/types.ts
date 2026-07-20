export type Position = 'GK' | 'DF' | 'MF' | 'FW';

export interface Player {
  id: string;
  name: string;
  position: Position;
  attack: number;
  defense: number;
  speed: number;
  technique: number;
  stamina: number;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  color: string;
  players: Player[];
}

export type EventKind =
  | 'kickoff'
  | 'chance'
  | 'shot'
  | 'goal'
  | 'save'
  | 'block'
  | 'miss'
  | 'halftime'
  | 'fulltime';

export interface MatchEvent {
  minute: number;
  kind: EventKind;
  side?: 'home' | 'away';
  text: string;
}

export interface MatchResult {
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
}

export interface Fixture {
  round: number;
  homeId: string;
  awayId: string;
  result?: MatchResult;
}

export interface StandingRow {
  teamId: string;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}
