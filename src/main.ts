import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { CAN_STORE, persist, restore } from './storage';
import { defaultState, type AppState, type EventSrc, type Focus, type Player, type TeamId } from './state';
import { PRESETS, type StatDef } from './presets';
import { parse, z2h } from './parse';
import { disp, render, type RenderHandlers } from './render';

registerSW({ immediate: true });

const state: AppState = restore() ?? defaultState();

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const n = document.getElementById(id);
  if (!n) throw new Error('missing #' + id);
  return n as T;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string, kind?: 'ok' | 'err'): void {
  const t = el('toast');
  t.textContent = msg;
  t.className = 'toast show' + (kind ? ' ' + kind : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.className = 'toast' + (kind ? ' ' + kind : '');
  }, 1600);
}

function addEvent(team: TeamId, playerId: string, statId: string, src: EventSrc): void {
  state.events.push({ id: ++state._eid, team, playerId, statId, src });
  persist(state);
  rerender();
}

function undo(): void {
  if (!state.events.length) {
    toast('取り消すものがありません', 'err');
    return;
  }
  state.events.pop();
  persist(state);
  rerender();
}

function resetGame(): void {
  if (!state.events.length) {
    toast('すでに空です');
    return;
  }
  if (!confirm('この試合の記録をすべて消します。よろしいですか？')) return;
  state.events = [];
  state.armed = null;
  persist(state);
  rerender();
  toast('リセットしました');
}

function runCommand(raw: string, src: EventSrc): boolean {
  const r = parse(state, raw);
  if (!r.ok) {
    toast('⚠ ' + r.err, 'err');
    return false;
  }
  addEvent(r.team, r.player.id, r.stat.id, src);
  toast('✓ ' + state.teams[r.team].name + ' ' + disp(r.player) + ' ' + r.stat.label, 'ok');
  return true;
}

const handlers: RenderHandlers = {
  onArmedToggle(team, playerId) {
    const on = !!state.armed && state.armed.team === team && state.armed.playerId === playerId;
    state.armed = on ? null : { team, playerId };
    rerender();
  },
  onArmedClear() {
    state.armed = null;
    rerender();
  },
  onStatTap(stat: StatDef, button: HTMLButtonElement) {
    if (!state.armed) {
      toast('先に選手を選んでください', 'err');
      return;
    }
    addEvent(state.armed.team, state.armed.playerId, stat.id, 'tap');
    button.classList.add('flash');
    setTimeout(() => button.classList.remove('flash'), 220);
  },
};

function rerender(): void {
  render(state, handlers);
}

// ---------- settings ----------
function rosterToText(team: TeamId): string {
  return state.teams[team].players
    .map((p) => (p.num != null ? String(p.num) : '') + (p.name ? ' ' + p.name : ''))
    .join('\n')
    .trim();
}

function renderStatConfig(): void {
  const host = el('statConfig');
  host.innerHTML = '';
  const list: StatDef[] = [...PRESETS, ...state.customs];
  for (const s of list) {
    const on = state.statIds.indexOf(s.id) > -1;
    const isCustom = 'custom' in s && s.custom === true;
    const row = document.createElement('div');
    row.className = 'statrow';
    row.innerHTML =
      '<input type="checkbox" ' + (on ? 'checked' : '') + '>' +
      '<span class="lab">' + s.label + '</span>' +
      '<span class="pt">' + (s.pts ? '+' + s.pts : '　') + '</span>' +
      (isCustom ? '<button class="rm">削除</button>' : '');
    const cb = row.querySelector('input') as HTMLInputElement;
    cb.onchange = () => {
      const i = state.statIds.indexOf(s.id);
      if (cb.checked) {
        if (i < 0) state.statIds.push(s.id);
      } else if (i > -1) {
        state.statIds.splice(i, 1);
      }
    };
    if (isCustom) {
      const rm = row.querySelector('.rm') as HTMLButtonElement;
      rm.onclick = () => {
        state.customs = state.customs.filter((c) => c.id !== s.id);
        const i = state.statIds.indexOf(s.id);
        if (i > -1) state.statIds.splice(i, 1);
        state.events = state.events.filter((e) => e.statId !== s.id);
        renderStatConfig();
      };
    }
    host.appendChild(row);
  }
}

function openSettings(): void {
  (el('tnameA') as HTMLInputElement).value = state.teams.A.name;
  (el('tnameB') as HTMLInputElement).value = state.teams.B.name;
  (el('rosterA') as HTMLTextAreaElement).value = rosterToText('A');
  (el('rosterB') as HTMLTextAreaElement).value = rosterToText('B');
  renderStatConfig();
  (el('storeBanner') as HTMLDivElement).style.display = CAN_STORE ? 'none' : 'block';
  el('settings').classList.add('open');
  (el('inputPanel') as HTMLDivElement).style.display = 'none';
}

function closeSettings(): void {
  el('settings').classList.remove('open');
  (el('inputPanel') as HTMLDivElement).style.display = 'block';
}

function reconcileRoster(team: TeamId, text: string): Player[] {
  const existing = state.teams[team].players.slice();
  const used: Record<string, true> = {};
  const out: Player[] = [];
  for (const rawLine of text.split('\n')) {
    const line = z2h(rawLine).trim();
    if (!line) continue;
    const m = line.match(/^(\d+)?\s*(.*)$/);
    if (!m) continue;
    const num: number | null = m[1] != null && m[1] !== '' ? parseInt(m[1], 10) : null;
    const name = (m[2] ?? '').trim();
    let match: Player | null = null;
    if (num != null) {
      for (const ex of existing) {
        if (used[ex.id]) continue;
        if (ex.num === num) { match = ex; break; }
      }
    }
    if (!match && name) {
      for (const ex of existing) {
        if (used[ex.id]) continue;
        if (ex.name === name) { match = ex; break; }
      }
    }
    const id = match ? match.id : 'p' + ++state._pid;
    if (match) used[match.id] = true;
    out.push({ id, num, name });
  }
  return out;
}

el('addStat').onclick = () => {
  const labInput = el('newStatLabel') as HTMLInputElement;
  const ptsInput = el('newStatPts') as HTMLInputElement;
  const lab = labInput.value.trim();
  if (!lab) {
    toast('項目名を入力', 'err');
    return;
  }
  const pts = parseInt(ptsInput.value, 10) || 0;
  const id = 'c' + ++state._cid;
  state.customs.push({
    id,
    label: lab,
    sub: lab.slice(0, 4),
    pts,
    kw: [lab],
    custom: true,
  });
  state.statIds.push(id);
  labInput.value = '';
  ptsInput.value = '0';
  renderStatConfig();
};

el('saveSettings').onclick = () => {
  const na = (el('tnameA') as HTMLInputElement).value.trim() || '濃';
  const nb = (el('tnameB') as HTMLInputElement).value.trim() || '淡';
  state.teams.A.name = na;
  state.teams.B.name = nb;
  const ra = reconcileRoster('A', (el('rosterA') as HTMLTextAreaElement).value);
  const rb = reconcileRoster('B', (el('rosterB') as HTMLTextAreaElement).value);
  if (!ra.length || !rb.length) {
    toast('各チーム最低1人', 'err');
    return;
  }
  state.teams.A.players = ra;
  state.teams.B.players = rb;
  if (!state.statIds.length) {
    toast('項目を最低1つ', 'err');
    return;
  }
  // 削除された選手のイベントを剪定
  const valid: Record<string, true> = {};
  for (const t of ['A', 'B'] as TeamId[]) {
    for (const p of state.teams[t].players) valid[t + ':' + p.id] = true;
  }
  state.events = state.events.filter((e) => valid[e.team + ':' + e.playerId]);
  state.armed = null;
  persist(state);
  closeSettings();
  rerender();
  toast('保存しました', 'ok');
};

el('gear').onclick = () => {
  if (el('settings').classList.contains('open')) closeSettings();
  else openSettings();
};

el('focusSeg').addEventListener('click', (e) => {
  const target = e.target as HTMLElement | null;
  const btn = target?.closest('button') as HTMLButtonElement | null;
  if (!btn || !btn.dataset.f) return;
  state.focus = btn.dataset.f as Focus;
  persist(state);
  rerender();
});

el('cmdGo').onclick = () => {
  const inp = el('cmdInput') as HTMLInputElement;
  if (runCommand(inp.value, 'cmd')) inp.value = '';
};
el('cmdInput').addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') (el('cmdGo') as HTMLButtonElement).click();
});

// ---------- voice ----------
type SRConstructor = new () => SpeechRecognitionLike;
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((ev: { results: { 0: { 0: { transcript: string } } } & ArrayLike<unknown> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
const SR: SRConstructor | undefined =
  (window as unknown as { SpeechRecognition?: SRConstructor }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: SRConstructor }).webkitSpeechRecognition;

let listening = false;
if (SR) {
  const rec = new SR();
  rec.lang = 'ja-JP';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = false;
  rec.onresult = (ev) => {
    const txt = ev.results[0][0].transcript;
    (el('cmdInput') as HTMLInputElement).value = txt;
    runCommand(txt, 'voice');
  };
  rec.onerror = (ev) => {
    listening = false;
    (el('mic') as HTMLButtonElement).classList.remove('live');
    const blocked = ev.error === 'not-allowed' || ev.error === 'service-not-allowed';
    toast(blocked ? '🎙️ マイク不可。入力欄をどうぞ' : '🎙️ 認識できませんでした', 'err');
  };
  rec.onend = () => {
    listening = false;
    (el('mic') as HTMLButtonElement).classList.remove('live');
  };
  el('mic').onclick = () => {
    if (listening) {
      try { rec.stop(); } catch { /* ignore */ }
      return;
    }
    try {
      rec.start();
      listening = true;
      (el('mic') as HTMLButtonElement).classList.add('live');
    } catch {
      toast('🎙️ 起動できませんでした', 'err');
    }
  };
} else {
  const mic = el('mic') as HTMLButtonElement;
  mic.textContent = '🎙️ 音声非対応（入力欄を使用）';
  mic.disabled = true;
}

(el('undo') as HTMLButtonElement).onclick = undo;
(el('reset') as HTMLButtonElement).onclick = resetGame;

if (!CAN_STORE) (el('storeBannerMain') as HTMLDivElement).style.display = 'block';

rerender();
