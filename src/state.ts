export type TeamId = 'A' | 'B';
export type Focus = 'both' | TeamId;
export type EventSrc = 'tap' | 'cmd' | 'voice';
export type Tone = 'dark' | 'light';

export interface Player {
  id: string;
  num: number | null;
  name: string;
}

export interface Team {
  name: string;
  tone: Tone;
  players: Player[];
}

export interface CustomStat {
  id: string;
  label: string;
  sub: string;
  pts: number;
  kw: string[];
  custom: true;
}

export interface RecordedEvent {
  id: number;
  team: TeamId;
  playerId: string;
  statId: string;
  src: EventSrc;
}

export interface Armed {
  team: TeamId;
  playerId: string;
}

export interface AppState {
  v: 1;
  teams: { A: Team; B: Team };
  statIds: string[];
  customs: CustomStat[];
  focus: Focus;
  armed: Armed | null;
  events: RecordedEvent[];
  _pid: number;
  _eid: number;
  _cid: number;
}

export function defaultState(): AppState {
  let pid = 0;
  const make = (nums: number[]): Player[] =>
    nums.map((n) => ({ id: 'p' + ++pid, num: n, name: '' }));
  return {
    v: 1,
    teams: {
      A: { name: '濃', tone: 'dark', players: make([4, 5, 7, 10, 23]) },
      B: { name: '淡', tone: 'light', players: make([3, 6, 8, 11, 21]) },
    },
    statIds: ['p2', 'p3', 'ft', 'reb', 'ast', 'stl', 'blk', 'pf', 'to'],
    customs: [],
    focus: 'both',
    armed: null,
    events: [],
    _pid: pid,
    _eid: 0,
    _cid: 0,
  };
}
