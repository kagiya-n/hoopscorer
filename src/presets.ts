import type { AppState, CustomStat } from './state';

export interface PresetStat {
  id: string;
  label: string;
  sub: string;
  pts: number;
  kw: string[];
  custom?: false;
}

export type StatDef = PresetStat | CustomStat;

export const PRESETS: PresetStat[] = [
  { id: 'p2', label: '2点', sub: '2P', pts: 2, kw: ['2点', 'ツー', 'two', '2p', '得点', 'ゴール', 'シュート', 'レイアップ'] },
  { id: 'p3', label: '3P', sub: '3P', pts: 3, kw: ['スリー', '3点', 'three', '3p', 'スリーポイント', 'トレ'] },
  { id: 'ft', label: 'フリースロー', sub: 'FT', pts: 1, kw: ['フリースロー', 'フリー', 'ft', '1点', 'ワンスロー'] },
  { id: 'reb', label: 'リバウンド', sub: 'REB', pts: 0, kw: ['リバウンド', 'リバ', 'ボード', 'rebound'] },
  { id: 'ast', label: 'アシスト', sub: 'AST', pts: 0, kw: ['アシスト', 'アシ', 'assist'] },
  { id: 'stl', label: 'スチール', sub: 'STL', pts: 0, kw: ['スチール', 'スティール', 'カット', 'steal'] },
  { id: 'blk', label: 'ブロック', sub: 'BLK', pts: 0, kw: ['ブロック', 'block'] },
  { id: 'pf', label: 'ファウル', sub: 'PF', pts: 0, kw: ['ファウル', 'foul', '反則'] },
  { id: 'to', label: 'ターンオーバー', sub: 'TO', pts: 0, kw: ['ターンオーバー', 'ターン', 'ミス', 'turnover', 'to'] },
];

export function statDef(state: AppState, id: string): StatDef | null {
  for (const p of PRESETS) if (p.id === id) return p;
  for (const c of state.customs) if (c.id === id) return c;
  return null;
}

export function activeStats(state: AppState): StatDef[] {
  return state.statIds
    .map((id) => statDef(state, id))
    .filter((s): s is StatDef => s !== null);
}
