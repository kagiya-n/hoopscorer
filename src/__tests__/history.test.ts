import { describe, expect, it } from 'vitest';
import { defaultState, type AppState } from '../state';
import {
  autoLabel,
  buildGameId,
  formatGameAsMarkdown,
  formatGameAsText,
  snapshotAsGame,
} from '../history';

function fixture(): AppState {
  const s = defaultState();
  s.teams.A.players = [
    { id: 'p1', num: 10, name: 'タナカ' },
    { id: 'p2', num: 23, name: 'サトウ' },
  ];
  s.teams.B.players = [
    { id: 'p3', num: 5, name: 'スズキ' },
    { id: 'p4', num: 8, name: 'ヤマダ' },
  ];
  s.events = [
    { id: 1, team: 'A', playerId: 'p1', statId: 'p3', src: 'tap' }, // タナカ 3P
    { id: 2, team: 'A', playerId: 'p1', statId: 'ast', src: 'tap' }, // タナカ AST
    { id: 3, team: 'A', playerId: 'p2', statId: 'p2', src: 'tap' }, // サトウ 2P
    { id: 4, team: 'B', playerId: 'p3', statId: 'ft', src: 'tap' }, // スズキ FT
    { id: 5, team: 'B', playerId: 'p4', statId: 'reb', src: 'tap' }, // ヤマダ REB
  ];
  return s;
}

describe('snapshotAsGame', () => {
  it('得点系イベントの合計でチームスコアを集計する', () => {
    const g = snapshotAsGame(fixture(), 'test', new Date('2026-06-19T10:00:00Z'));
    expect(g.scoreA).toBe(5); // タナカ3P + サトウ2P
    expect(g.scoreB).toBe(1); // スズキFT
  });

  it('teams を deep copy して元の state を共有しない', () => {
    const s = fixture();
    const g = snapshotAsGame(s, 'test', new Date('2026-06-19T10:00:00Z'));
    s.teams.A.players[0]!.name = '別人';
    expect(g.teams.A.players[0]!.name).toBe('タナカ');
  });
});

describe('autoLabel / buildGameId', () => {
  it('autoLabel は「YYYY-MM-DD 濃A-B淡」形式', () => {
    const d = new Date(2026, 5, 19, 10, 30);
    expect(autoLabel(d, 42, 38, '濃', '淡')).toBe('2026-06-19 濃42-38淡');
  });
  it('buildGameId は g_YYYYMMDD_HHMMSS', () => {
    const d = new Date(2026, 0, 5, 9, 7, 3);
    expect(buildGameId(d)).toBe('g_20260105_090703');
  });
});

describe('formatGameAsText', () => {
  it('ラベルとスコアと両チーム見出しを含む', () => {
    const g = snapshotAsGame(fixture(), '練習試合', new Date('2026-06-19T01:00:00Z'));
    const out = formatGameAsText(g);
    expect(out).toContain('練習試合');
    expect(out).toContain('濃 5 : 1 淡');
    expect(out).toContain('── 濃 ──');
    expect(out).toContain('── 淡 ──');
    expect(out).toContain('タナカ');
    expect(out).toContain('PTS  5');
  });
});

describe('formatGameAsMarkdown', () => {
  it('Markdown 表ヘッダと合計行を含む', () => {
    const g = snapshotAsGame(fixture(), '練習試合', new Date('2026-06-19T01:00:00Z'));
    const md = formatGameAsMarkdown(g);
    expect(md).toContain('**練習試合 — 濃 5 : 1 淡**');
    expect(md).toContain('### 濃');
    expect(md).toContain('### 淡');
    expect(md).toContain('| 選手 | PTS |');
    expect(md).toMatch(/\| \*\*計\*\* \| \*\*5\*\* \|/);
    expect(md).toMatch(/\| \*\*計\*\* \| \*\*1\*\* \|/);
  });

  it('右寄せのアラインメント行が PTS 以降に含まれる', () => {
    const g = snapshotAsGame(fixture(), 'x', new Date('2026-06-19T01:00:00Z'));
    const md = formatGameAsMarkdown(g);
    // 選手列だけ左寄せ、それ以降は右寄せ
    expect(md).toContain('| --- | ---:');
  });
});
