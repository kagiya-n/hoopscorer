import type { AppState, Player, TeamId } from './state';
import { activeStats, statDef, type StatDef } from './presets';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error('missing #' + id);
  return node as T;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[c] as string));
}

export function accent(state: AppState, team: TeamId): string {
  return state.teams[team].tone === 'dark' ? 'var(--steel)' : 'var(--bone)';
}

export function toneClass(state: AppState, team: TeamId): 'dark' | 'light' {
  return state.teams[team].tone;
}

export function disp(p: Player): string {
  return p.name ? p.name : '#' + (p.num ?? '');
}

export function playerById(state: AppState, team: TeamId, id: string): Player | null {
  for (const p of state.teams[team].players) if (p.id === id) return p;
  return null;
}

export function teamScore(state: AppState, team: TeamId): number {
  let s = 0;
  for (const e of state.events) {
    if (e.team !== team) continue;
    const d = statDef(state, e.statId);
    if (d) s += d.pts;
  }
  return s;
}

function lineFor(state: AppState, team: TeamId, playerId: string): Record<string, number> {
  const line: Record<string, number> = { pts: 0 };
  for (const s of activeStats(state)) line[s.id] = 0;
  for (const e of state.events) {
    if (e.team !== team || e.playerId !== playerId) continue;
    if (line[e.statId] !== undefined) line[e.statId]++;
    const d = statDef(state, e.statId);
    if (d) line.pts += d.pts;
  }
  return line;
}

function teamsToShow(state: AppState): TeamId[] {
  return state.focus === 'both' ? ['A', 'B'] : [state.focus];
}

export interface RenderHandlers {
  onArmedToggle: (team: TeamId, playerId: string) => void;
  onArmedClear: () => void;
  onStatTap: (stat: StatDef, button: HTMLButtonElement) => void;
}

function renderScore(state: AppState): void {
  el('nameA').textContent = state.teams.A.name;
  el('nameB').textContent = state.teams.B.name;
  el('scoreA').textContent = String(teamScore(state, 'A'));
  el('scoreB').textContent = String(teamScore(state, 'B'));
}

function renderFocus(state: AppState): void {
  const seg = el('focusSeg');
  seg.querySelectorAll('button').forEach((b) => {
    const btn = b as HTMLButtonElement;
    btn.classList.toggle('on', btn.dataset.f === state.focus);
  });
  const buttons = seg.children;
  buttons[1]!.textContent = state.teams.A.name + 'に集中';
  buttons[2]!.textContent = state.teams.B.name + 'に集中';
}

function renderChips(state: AppState, h: RenderHandlers): void {
  const host = el('teamChips');
  host.innerHTML = '';
  for (const team of teamsToShow(state)) {
    const block = document.createElement('div');
    block.className = 'teamblock';
    block.innerHTML =
      '<div class="teamlabel ' + toneClass(state, team) + '">' +
      '<span class="dot" style="background:' + accent(state, team) + '"></span>' +
      esc(state.teams[team].name) + '</div>';
    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const p of state.teams[team].players) {
      const on = !!state.armed && state.armed.team === team && state.armed.playerId === p.id;
      const b = document.createElement('button');
      b.className = 'chip ' + toneClass(state, team) + (on ? ' on' : '');
      b.textContent = disp(p);
      b.onclick = () => h.onArmedToggle(team, p.id);
      chips.appendChild(b);
    }
    block.appendChild(chips);
    host.appendChild(block);
  }
}

function renderArmed(state: AppState, h: RenderHandlers): void {
  const a = el('armed');
  if (!state.armed || !playerById(state, state.armed.team, state.armed.playerId)) {
    state.armed = null;
    a.className = 'armed empty';
    a.textContent = '記録する選手をタップ → 項目を選択';
    return;
  }
  const p = playerById(state, state.armed.team, state.armed.playerId)!;
  a.className = 'armed';
  a.innerHTML =
    '<span class="dot" style="background:' + accent(state, state.armed.team) + '"></span>' +
    '選択中　' + esc(state.teams[state.armed.team].name) + ' ' + esc(disp(p)) +
    '<button class="clear" id="clearArmed">解除</button>';
  el('clearArmed').onclick = () => h.onArmedClear();
}

function renderStats(state: AppState, h: RenderHandlers): void {
  const box = el('stats');
  box.innerHTML = '';
  for (const t of activeStats(state)) {
    const b = document.createElement('button');
    b.className = 'statbtn';
    b.innerHTML = esc(t.label) + '<small>' + esc(t.sub) + (t.pts ? (' +' + t.pts) : '') + '</small>';
    b.onclick = () => h.onStatTap(t, b);
    box.appendChild(b);
  }
}

function renderFeed(state: AppState): void {
  const f = el('feed');
  if (!state.events.length) {
    f.innerHTML = '<div class="feed-empty">まだ記録がありません。</div>';
    return;
  }
  f.innerHTML = '';
  const tail = state.events.slice(-7).reverse();
  for (const e of tail) {
    const p = playerById(state, e.team, e.playerId);
    const d = statDef(state, e.statId);
    const row = document.createElement('div');
    row.className = 'ev';
    const srcLabel = e.src === 'voice' ? '🎙️音声' : e.src === 'cmd' ? '⌨︎入力' : 'タップ';
    row.innerHTML =
      '<span class="dot" style="background:' + accent(state, e.team) + '"></span>' +
      esc(p ? disp(p) : '?') +
      ' <span class="grow">' + esc(d ? d.label : '?') + '</span>' +
      '<span class="src">' + srcLabel + '</span>';
    f.appendChild(row);
  }
}

function renderBox(state: AppState): void {
  const host = el('boxPanel');
  host.innerHTML = '<p class="eyebrow">ボックススコア</p>';
  const cols = activeStats(state);
  for (const team of teamsToShow(state)) {
    const head = document.createElement('div');
    head.className = 'bs-head';
    head.innerHTML =
      '<span class="dot" style="background:' + accent(state, team) + '"></span>' +
      '<h3>' + esc(state.teams[team].name) + '</h3>';
    host.appendChild(head);

    const th =
      '<th class="num">選手</th><th>PTS</th>' +
      cols.map((c) => '<th>' + esc(c.sub) + '</th>').join('');
    const tot: Record<string, number> = { pts: 0 };
    for (const c of cols) tot[c.id] = 0;
    let rows = '';
    for (const p of state.teams[team].players) {
      const l = lineFor(state, team, p.id);
      tot.pts += l.pts;
      rows +=
        '<tr><td class="num">' + esc(disp(p)) + '</td>' +
        '<td class="ptscol">' + l.pts + '</td>' +
        cols.map((c) => {
          tot[c.id] += l[c.id]!;
          return '<td>' + l[c.id] + '</td>';
        }).join('') + '</tr>';
    }
    rows +=
      '<tr class="total"><td class="num">計</td>' +
      '<td class="ptscol">' + tot.pts + '</td>' +
      cols.map((c) => '<td>' + tot[c.id] + '</td>').join('') + '</tr>';
    const w = document.createElement('div');
    w.className = 'box-scroll';
    w.innerHTML = '<table><thead><tr>' + th + '</tr></thead><tbody>' + rows + '</tbody></table>';
    host.appendChild(w);
  }
}

export function render(state: AppState, handlers: RenderHandlers): void {
  renderScore(state);
  renderFocus(state);
  renderChips(state, handlers);
  renderArmed(state, handlers);
  renderStats(state, handlers);
  renderFeed(state);
  renderBox(state);
}
