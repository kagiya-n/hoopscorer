import type { AppState, Player, TeamId } from './state';
import { activeStats, type StatDef } from './presets';

export interface ParseOk {
  ok: true;
  team: TeamId;
  player: Player;
  stat: StatDef;
}

export interface ParseErr {
  ok: false;
  err: string;
}

export type ParseResult = ParseOk | ParseErr;

function ok(team: TeamId, player: Player, stat: StatDef): ParseOk {
  return { ok: true, team, player, stat };
}

function fail(err: string): ParseErr {
  return { ok: false, err };
}

export function z2h(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

export function norm(s: unknown): string {
  return z2h(String(s ?? '')).toLowerCase().trim();
}

export function parse(state: AppState, raw: string): ParseResult {
  const s = norm(raw);
  if (!s) return fail('空のコマンドです');

  // チーム名 → トーン語 の順で識別
  let team: TeamId | null = null;
  const na = norm(state.teams.A.name);
  const nb = norm(state.teams.B.name);
  if (na && s.indexOf(na) > -1) team = 'A';
  else if (nb && s.indexOf(nb) > -1) team = 'B';
  if (!team) {
    if (/濃|dark|こい/.test(s)) team = state.teams.A.tone === 'dark' ? 'A' : 'B';
    else if (/淡|light|うす|あわ/.test(s)) team = state.teams.A.tone === 'light' ? 'A' : 'B';
  }

  // 項目
  let stat: StatDef | null = null;
  const as = activeStats(state);
  outer: for (const a of as) {
    for (const k of a.kw) {
      if (k && s.indexOf(norm(k)) > -1) {
        stat = a;
        break outer;
      }
    }
  }

  // 最初の数値を背番号として採用
  const nm = s.match(/\d+/g);
  const num: number | null = nm ? parseInt(nm[0], 10) : null;

  if (!stat) return fail('項目名が読み取れません');

  const findInTeam = (t: TeamId): Player | null => {
    const ps = state.teams[t].players;
    if (num != null) {
      for (const p of ps) if (p.num === num) return p;
      return null;
    }
    for (const p of ps) if (p.name && s.indexOf(norm(p.name)) > -1) return p;
    return null;
  };

  if (team) {
    const p = findInTeam(team);
    if (!p) {
      const who = num != null ? '#' + num : 'その選手';
      return fail(who + ' が' + state.teams[team].name + 'にいません');
    }
    return ok(team, p, stat);
  }

  const pa = findInTeam('A');
  const pb = findInTeam('B');
  if (pa && !pb) return ok('A', pa, stat);
  if (pb && !pa) return ok('B', pb, stat);
  if (pa && pb) return fail('どちらのチームか特定できません');
  return fail('選手が見つかりません');
}
