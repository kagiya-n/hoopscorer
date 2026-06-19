import type { AppState, CustomStat, RecordedEvent, Team, TeamId } from './state';
import { PRESETS, type StatDef } from './presets';

const HISTORY_KEY = 'hoops_tracker_games_v1';

export interface SavedGame {
  id: string;
  finishedAt: string;
  label: string;
  teams: { A: Team; B: Team };
  statIds: string[];
  customs: CustomStat[];
  events: RecordedEvent[];
  scoreA: number;
  scoreB: number;
}

function canStore(): boolean {
  try {
    localStorage.setItem('__t', '1');
    localStorage.removeItem('__t');
    return true;
  } catch {
    return false;
  }
}

export function loadHistory(): SavedGame[] {
  if (!canStore()) return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedGame[]) : [];
  } catch {
    return [];
  }
}

function writeHistory(list: SavedGame[]): void {
  if (!canStore()) return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    // 容量超過は無視（メモリ動作にフォールバック）
  }
}

export function saveGame(game: SavedGame): SavedGame[] {
  const next = [game, ...loadHistory()];
  writeHistory(next);
  return next;
}

export function deleteGame(id: string): SavedGame[] {
  const next = loadHistory().filter((g) => g.id !== id);
  writeHistory(next);
  return next;
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function formatTimestamp(d: Date): string {
  return (
    d.getFullYear() +
    '-' + pad2(d.getMonth() + 1) +
    '-' + pad2(d.getDate()) +
    ' ' + pad2(d.getHours()) +
    ':' + pad2(d.getMinutes())
  );
}

export function buildGameId(d: Date): string {
  return (
    'g_' +
    d.getFullYear() +
    pad2(d.getMonth() + 1) +
    pad2(d.getDate()) +
    '_' +
    pad2(d.getHours()) +
    pad2(d.getMinutes()) +
    pad2(d.getSeconds())
  );
}

export function autoLabel(d: Date, scoreA: number, scoreB: number, nameA: string, nameB: string): string {
  return (
    d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    ' ' + nameA + scoreA + '-' + scoreB + nameB
  );
}

function statDefIn(game: SavedGame, id: string): StatDef | null {
  for (const p of PRESETS) if (p.id === id) return p;
  for (const c of game.customs) if (c.id === id) return c;
  return null;
}

function activeStatsIn(game: SavedGame): StatDef[] {
  return game.statIds
    .map((id) => statDefIn(game, id))
    .filter((s): s is StatDef => s !== null);
}

function displayPlayer(p: { num: number | null; name: string }): string {
  return p.name ? p.name : '#' + (p.num ?? '');
}

function lineFor(game: SavedGame, team: TeamId, playerId: string, cols: StatDef[]): Record<string, number> {
  const line: Record<string, number> = { pts: 0 };
  for (const c of cols) line[c.id] = 0;
  for (const e of game.events) {
    if (e.team !== team || e.playerId !== playerId) continue;
    if (line[e.statId] !== undefined) line[e.statId]++;
    const d = statDefIn(game, e.statId);
    if (d) line.pts += d.pts;
  }
  return line;
}

function padCol(s: string, w: number, alignRight = false): string {
  // 全角を 2 幅でカウントしてターミナル風の等幅整列に寄せる（Markdown では使わない）
  let width = 0;
  for (const ch of s) width += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  const space = ' '.repeat(Math.max(0, w - width));
  return alignRight ? space + s : s + space;
}

export function formatGameAsText(game: SavedGame): string {
  const cols = activeStatsIn(game);
  const lines: string[] = [];
  lines.push(game.label);
  lines.push(game.teams.A.name + ' ' + game.scoreA + ' : ' + game.scoreB + ' ' + game.teams.B.name);
  lines.push('');

  for (const team of ['A', 'B'] as TeamId[]) {
    lines.push('── ' + game.teams[team].name + ' ──');
    for (const p of game.teams[team].players) {
      const l = lineFor(game, team, p.id, cols);
      const parts = ['PTS ' + padCol(String(l.pts), 2, true)];
      for (const c of cols) parts.push(c.sub + ' ' + padCol(String(l[c.id]), 2, true));
      lines.push(padCol(displayPlayer(p), 10) + ' ' + parts.join(' / '));
    }
    // チーム合計
    const tot: Record<string, number> = { pts: 0 };
    for (const c of cols) tot[c.id] = 0;
    for (const p of game.teams[team].players) {
      const l = lineFor(game, team, p.id, cols);
      tot.pts += l.pts;
      for (const c of cols) tot[c.id] += l[c.id]!;
    }
    const totParts = ['PTS ' + padCol(String(tot.pts), 2, true)];
    for (const c of cols) totParts.push(c.sub + ' ' + padCol(String(tot[c.id]), 2, true));
    lines.push(padCol('計', 10) + ' ' + totParts.join(' / '));
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

export function formatGameAsMarkdown(game: SavedGame): string {
  const cols = activeStatsIn(game);
  const out: string[] = [];
  out.push(
    '**' + game.label + ' — ' +
    game.teams.A.name + ' ' + game.scoreA + ' : ' + game.scoreB + ' ' + game.teams.B.name +
    '**',
  );
  out.push('');

  for (const team of ['A', 'B'] as TeamId[]) {
    out.push('### ' + game.teams[team].name);
    const header = ['選手', 'PTS', ...cols.map((c) => c.sub)];
    const align = ['---', ...new Array<string>(1 + cols.length).fill('---:')];
    out.push('| ' + header.join(' | ') + ' |');
    out.push('| ' + align.join(' | ') + ' |');
    const tot: Record<string, number> = { pts: 0 };
    for (const c of cols) tot[c.id] = 0;
    for (const p of game.teams[team].players) {
      const l = lineFor(game, team, p.id, cols);
      tot.pts += l.pts;
      const row = [displayPlayer(p), String(l.pts)];
      for (const c of cols) {
        tot[c.id] += l[c.id]!;
        row.push(String(l[c.id]));
      }
      out.push('| ' + row.join(' | ') + ' |');
    }
    const totRow = ['**計**', '**' + tot.pts + '**'];
    for (const c of cols) totRow.push('**' + tot[c.id] + '**');
    out.push('| ' + totRow.join(' | ') + ' |');
    out.push('');
  }
  return out.join('\n').trimEnd();
}

export function snapshotAsGame(state: AppState, label: string, when: Date): SavedGame {
  let a = 0;
  let b = 0;
  for (const e of state.events) {
    const d = PRESETS.find((p) => p.id === e.statId) ??
      state.customs.find((c) => c.id === e.statId) ??
      null;
    if (!d) continue;
    if (e.team === 'A') a += d.pts;
    else b += d.pts;
  }
  return {
    id: buildGameId(when),
    finishedAt: when.toISOString(),
    label,
    teams: {
      A: { ...state.teams.A, players: state.teams.A.players.map((p) => ({ ...p })) },
      B: { ...state.teams.B, players: state.teams.B.players.map((p) => ({ ...p })) },
    },
    statIds: state.statIds.slice(),
    customs: state.customs.map((c) => ({ ...c })),
    events: state.events.map((e) => ({ ...e })),
    scoreA: a,
    scoreB: b,
  };
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // フォールバックへ
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
