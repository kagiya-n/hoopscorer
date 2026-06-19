import { describe, expect, it } from 'vitest';
import { defaultState, type AppState } from '../state';
import { norm, parse, z2h } from '../parse';

function fixture(overrides?: Partial<AppState>): AppState {
  const s = defaultState();
  s.teams.A.players = [
    { id: 'p1', num: 10, name: 'タナカ' },
    { id: 'p2', num: 23, name: 'サトウ' },
    { id: 'p3', num: 4, name: '' },
  ];
  s.teams.B.players = [
    { id: 'p4', num: 5, name: 'スズキ' },
    { id: 'p5', num: 8, name: 'ヤマダ' },
    { id: 'p6', num: 11, name: '' },
  ];
  return { ...s, ...(overrides ?? {}) };
}

describe('z2h / norm', () => {
  it('全角数字を半角に変換する', () => {
    expect(z2h('１０')).toBe('10');
  });
  it('大文字小文字を畳んで前後の空白を落とす', () => {
    expect(norm('  ThREE  ')).toBe('three');
  });
});

describe('parse', () => {
  it('チーム名＋背番号＋項目で解決できる', () => {
    const r = parse(fixture(), '濃10 スリー');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.team).toBe('A');
    expect(r.player.num).toBe(10);
    expect(r.stat.id).toBe('p3');
  });

  it('チーム名＋選手名で解決できる（指定チームに該当選手）', () => {
    const r = parse(fixture(), '淡 スズキ アシスト');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.team).toBe('B');
    expect(r.player.name).toBe('スズキ');
    expect(r.stat.id).toBe('ast');
  });

  it('チーム名＋他チームの選手名は「いません」エラー', () => {
    const r = parse(fixture(), '淡 サトウ アシスト');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.err).toContain('にいません');
  });

  it('チーム省略時、選手が一意なら自動判定する', () => {
    const r = parse(fixture(), '23 リバウンド');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.team).toBe('A');
    expect(r.player.num).toBe(23);
    expect(r.stat.id).toBe('reb');
  });

  it('全角数字でも背番号として解決できる', () => {
    const r = parse(fixture(), '濃１０ ２点');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.player.num).toBe(10);
    expect(r.stat.id).toBe('p2');
  });

  it('両チームに同じ背番号がいる場合チーム省略は曖昧エラー', () => {
    const s = fixture();
    s.teams.B.players[0]!.num = 10;
    const r = parse(s, '10 アシスト');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.err).toBe('どちらのチームか特定できません');
  });

  it('項目が読み取れないときはエラー', () => {
    const r = parse(fixture(), '濃10');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.err).toBe('項目名が読み取れません');
  });

  it('指定チームに該当選手がいないときはエラー', () => {
    const r = parse(fixture(), '濃 99 スリー');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.err).toContain('にいません');
  });

  it('空文字はエラー', () => {
    const r1 = parse(fixture(), '');
    const r2 = parse(fixture(), '   ');
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    if (r1.ok || r2.ok) return;
    expect(r1.err).toBe('空のコマンドです');
    expect(r2.err).toBe('空のコマンドです');
  });

  it('「トレ」など3点系の別名でも 3P として解決する', () => {
    const r = parse(fixture(), '淡5 トレ');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stat.id).toBe('p3');
    expect(r.team).toBe('B');
  });

  it('カスタム項目のキーワードでも解決できる', () => {
    const s = fixture();
    s.customs.push({
      id: 'c1',
      label: 'ディフレクション',
      sub: 'ディフ',
      pts: 0,
      kw: ['ディフレクション', 'ディフ'],
      custom: true,
    });
    s.statIds.push('c1');
    const r = parse(s, '濃10 ディフレクション');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stat.id).toBe('c1');
  });
});
