'use strict';

/* =========================================================================
   TCG Tournament — Swiss pairings, round timer, standings and top cut.
   All data lives in localStorage on this device. Export to back up.
   ========================================================================= */

const STORE_KEY = 'tcg-to:v1';
const WIN_PTS = 3;
const DRAW_PTS = 1;
const WARN_MS = 5 * 60 * 1000;

// ---------- utils ----------------------------------------------------------

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (x) => (x * 100).toFixed(1);
const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmtTime(ms) {
  const over = ms < 0;
  const total = over ? Math.floor(-ms / 1000) : Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return (over ? '+' : '') + m + ':' + s;
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  players: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
  round: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/></svg>',
  standings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21V11M16 21V7M12 21V3M4 21v-6M20 21v-3"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>',
};

// ---------- storage --------------------------------------------------------

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    if (d && Array.isArray(d.tournaments)) return d;
  } catch (e) { /* fall through */ }
  return { tournaments: [], ui: null };
}

// Content fingerprint of a tournament, ignoring its save stamp.
const contentKey = (t) => JSON.stringify({ ...t, savedAt: 0 });
const seenKeys = new Map();

function save() {
  db.ui = { tid: ui.tid, tab: ui.tab };
  for (const t of db.tournaments) {
    const k = contentKey(t);
    if (seenKeys.get(t.id) !== k) { t.savedAt = Date.now(); seenKeys.set(t.id, k); }
  }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
  } catch (e) {
    if (!cloud.col) toast('Could not save — storage is full or blocked');
  }
  scheduleSync();
}

// ---------- account sync ---------------------------------------------------
// When opened on claude.ai, tournaments are also kept in the viewer's private
// storage there, so they survive a cleared browser and follow them to other devices.

const cloud = { col: null, synced: new Map(), timer: 0, busy: false, again: false };

async function initCloud() {
  if (!window.claude?.use) return;
  try {
    const [store, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    const id = store && user ? await user.id() : null;
    if (!id) return;
    const col = store.collection('data/users/' + id);
    const snap = await col.get();
    for (const d of snap.docs) {
      const remote = d.data()?.t;
      if (!remote || !remote.id || !Array.isArray(remote.players)) continue;
      const t = JSON.parse(JSON.stringify(remote));
      const i = db.tournaments.findIndex((x) => x.id === t.id);
      if (i < 0) db.tournaments.push(t);
      else if ((t.savedAt || 0) > (db.tournaments[i].savedAt || 0)) db.tournaments[i] = t;
      cloud.synced.set(t.id, contentKey(t));
      seenKeys.set(t.id, contentKey(db.tournaments[i < 0 ? db.tournaments.length - 1 : i]));
    }
    cloud.col = col;
    if (ui.tid && !T()) ui.tid = null;
    save(); // uploads anything only this device had
    if (!ui.modal && !dialog) render();
  } catch (e) {
    cloud.col = null;
  }
}

function scheduleSync(delay = 800) {
  if (!cloud.col) return;
  clearTimeout(cloud.timer);
  cloud.timer = setTimeout(flushSync, delay);
}

async function flushSync() {
  if (!cloud.col) return;
  if (cloud.busy) { cloud.again = true; return; }
  cloud.busy = true;
  try {
    for (const t of db.tournaments) {
      const k = contentKey(t);
      if (cloud.synced.get(t.id) === k) continue;
      await cloud.col.doc(t.id).set({ t: JSON.parse(JSON.stringify(t)), savedAt: t.savedAt || Date.now() });
      cloud.synced.set(t.id, k);
    }
    for (const id of [...cloud.synced.keys()]) {
      if (db.tournaments.some((t) => t.id === id)) continue;
      await cloud.col.doc(id).delete();
      cloud.synced.delete(id);
    }
  } catch (e) {
    if (e?.code === 'quota_exceeded') toast('Account storage is full. Delete old tournaments to keep syncing.');
    else if (e?.code === 'unavailable' || e?.code === 'resource_exhausted') cloud.again = true;
    else { cloud.col = null; toast('Syncing stopped. Tournaments are still saved on this device.'); }
  } finally {
    cloud.busy = false;
    if (cloud.again) { cloud.again = false; scheduleSync(5000); }
  }
}

// ---------- in-page dialogs ------------------------------------------------
// Used instead of confirm()/prompt(), which embedded pages may not show.

let dialog = null;

function openDialog(d) {
  dialog = d;
  render();
  setTimeout(() => { $('#dialog-input')?.select(); $('#dialog-text')?.select(); }, 50);
}

function renderDialog() {
  const d = dialog;
  return `
  <div class="modal-bg" data-act="dlg-cancel">
    <div class="sheet" role="dialog" aria-label="${esc(d.title)}">
      <h3>${esc(d.title)}</h3>
      ${d.message ? `<p class="center" style="margin:14px 0 18px">${esc(d.message)}</p>` : ''}
      ${d.input != null ? `<form data-form="dlg"><input id="dialog-input" name="v" maxlength="40" value="${esc(d.input)}" autocomplete="off" aria-label="${esc(d.title)}" style="margin:14px 0 16px"></form>` : ''}
      ${d.text != null ? `<p class="hint center">Select all and copy this text.</p><textarea id="dialog-text" readonly style="margin:10px 0 16px">${esc(d.text)}</textarea>` : ''}
      <div class="btns">
        ${d.onOk ? `<button class="btn ${d.danger ? 'danger' : 'primary'}" data-act="dlg-ok">${esc(d.okLabel || 'OK')}</button>` : ''}
        <button class="btn" data-act="dlg-cancel">${d.onOk ? 'Cancel' : 'Close'}</button>
      </div>
    </div>
  </div>`;
}

/** Share sheet on a phone browser; copy to clipboard where sharing isn't allowed. */
async function shareOrCopy(text, what) {
  const embedded = window.top !== window;
  if (!embedded && navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copied. Paste it anywhere.`);
  } catch (e) {
    openDialog({ title: what, text });
  }
}

function importTournament(t) {
  if (!t || !Array.isArray(t.players) || !Array.isArray(t.rounds) || !t.name) throw new Error('bad file');
  t.timer = t.timer || freshTimer(t.roundMinutes || 50);
  t.timer.running = false;
  const add = () => {
    db.tournaments.push(t);
    go({ screen: 'tournament', tid: t.id, tab: 'standings' });
    toast('Tournament imported');
  };
  if (db.tournaments.some((x) => x.id === t.id)) {
    openDialog({
      title: 'Already here', message: `“${t.name}” is already on this device. Import it as a copy?`, okLabel: 'Import copy',
      onOk: () => { t.id = uid(); t.name += ' (copy)'; add(); },
    });
  } else add();
}

let db = load();
for (const t of db.tournaments) seenKeys.set(t.id, contentKey(t));
let ui = { screen: 'home', tid: null, tab: 'players', roundIdx: null, modal: null };
if (db.ui && db.tournaments.some((t) => t.id === db.ui.tid)) {
  ui.screen = 'tournament';
  ui.tid = db.ui.tid;
  ui.tab = db.ui.tab || 'players';
}

const T = () => db.tournaments.find((t) => t.id === ui.tid);

// ---------- tournament model -----------------------------------------------

function newTournament({ name, game, roundMinutes, bestOf, swissRounds, topCut }) {
  return {
    id: uid(),
    created: Date.now(),
    name, game, roundMinutes, bestOf, swissRounds, topCut,
    players: [],
    rounds: [],
    phase: 'setup', // setup | running | done
    plannedRounds: 0,
    timer: freshTimer(roundMinutes),
  };
}

function freshTimer(minutes) {
  const remaining = minutes * 60000;
  return { running: false, endsAt: 0, remaining, warned: remaining <= WARN_MS, alarmed: false };
}

const gamesToWin = (t) => Math.ceil(t.bestOf / 2);
const suggestedRounds = (n) => (n <= 1 ? 0 : Math.ceil(Math.log2(n)));
const playerById = (t, id) => t.players.find((p) => p.id === id);
const pname = (t, id) => (id ? playerById(t, id)?.name ?? '?' : 'BYE');
const swissRoundsPlayed = (t) => t.rounds.filter((r) => r.type === 'swiss').length;
const plannedSwiss = (t) => t.swissRounds || t.plannedRounds || suggestedRounds(t.players.length);
const roundComplete = (r) => r.matches.every((m) => m.done);
const lastRound = (t) => t.rounds[t.rounds.length - 1];
const winnerOf = (m) => (!m.p2 ? m.p1 : m.g1 > m.g2 ? m.p1 : m.g2 > m.g1 ? m.p2 : null);

function roundLabel(r) {
  if (r.type === 'swiss') return 'Round ' + r.num;
  const n = r.matches.length * 2;
  return n === 2 ? 'Finals' : 'Top ' + n;
}

function computeStandings(t) {
  const need = gamesToWin(t);
  const S = new Map(t.players.map((p) => [p.id, {
    id: p.id, name: p.name, dropped: !!p.dropped,
    w: 0, l: 0, d: 0, mp: 0, gp: 0, games: 0, rounds: 0, byes: 0, opps: [],
  }]));

  for (const r of t.rounds) {
    if (r.type !== 'swiss') continue;
    for (const m of r.matches) {
      if (!m.done) continue;
      const a = S.get(m.p1);
      if (!a) continue;
      if (!m.p2) { // bye = match win, counted as a clean game win
        a.w++; a.mp += WIN_PTS; a.rounds++; a.byes++;
        a.gp += WIN_PTS * need; a.games += need;
        continue;
      }
      const b = S.get(m.p2);
      if (!b) continue;
      a.opps.push(b.id); b.opps.push(a.id);
      a.rounds++; b.rounds++;
      const games = m.g1 + m.g2;
      a.games += games; b.games += games;
      a.gp += WIN_PTS * m.g1; b.gp += WIN_PTS * m.g2;
      if (m.g1 > m.g2) { a.w++; b.l++; a.mp += WIN_PTS; }
      else if (m.g2 > m.g1) { b.w++; a.l++; b.mp += WIN_PTS; }
      else { a.d++; b.d++; a.mp += DRAW_PTS; b.mp += DRAW_PTS; }
    }
  }

  // Standard tiebreakers: OMW%, GW%, OGW% with a 33% floor.
  const floor = (x) => Math.max(1 / 3, x);
  for (const s of S.values()) {
    s.mwp = s.rounds ? floor(s.mp / (WIN_PTS * s.rounds)) : 1 / 3;
    s.gwp = s.games ? floor(s.gp / (WIN_PTS * s.games)) : 1 / 3;
  }
  for (const s of S.values()) {
    const opps = s.opps.map((id) => S.get(id));
    s.omw = opps.length ? avg(opps.map((o) => o.mwp)) : 0;
    s.ogw = opps.length ? avg(opps.map((o) => o.gwp)) : 0;
  }

  return [...S.values()].sort((a, b) =>
    b.mp - a.mp || b.omw - a.omw || b.gwp - a.gwp || b.ogw - a.ogw || a.name.localeCompare(b.name));
}

/** Pair the next Swiss round: group by points, avoid rematches, bye to lowest player without one. */
function pairSwissRound(t) {
  const standings = computeStandings(t);
  const pts = new Map(standings.map((s) => [s.id, s.mp]));
  const hadBye = new Set(standings.filter((s) => s.byes > 0).map((s) => s.id));
  const active = t.players.filter((p) => !p.dropped).map((p) => p.id);

  // Highest points first, random order inside each point group.
  let order = shuffle(active).sort((a, b) => pts.get(b) - pts.get(a));

  const played = new Set();
  for (const r of t.rounds) for (const m of r.matches) if (m.p2) played.add(pairKey(m.p1, m.p2));

  let bye = null;
  if (order.length % 2) {
    bye = [...order].reverse().find((id) => !hadBye.has(id)) ?? order[order.length - 1];
    order = order.filter((id) => id !== bye);
  }

  let steps = 0;
  const solve = (rest) => {
    if (!rest.length) return [];
    if (++steps > 50000) return null;
    const [a, ...others] = rest;
    for (let i = 0; i < others.length; i++) {
      if (played.has(pairKey(a, others[i]))) continue;
      const sub = solve(others.filter((_, j) => j !== i));
      if (sub) return [[a, others[i]], ...sub];
    }
    return null;
  };

  let pairs = solve(order);
  if (!pairs) {
    pairs = [];
    for (let i = 0; i < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
    toast('Some rematches could not be avoided');
  }

  const need = gamesToWin(t);
  const matches = pairs.map(([p1, p2], i) => ({ id: uid(), table: i + 1, p1, p2, g1: 0, g2: 0, done: false }));
  if (bye) matches.push({ id: uid(), table: null, p1: bye, p2: null, g1: need, g2: 0, done: true });

  t.rounds.push({ type: 'swiss', num: swissRoundsPlayed(t) + 1, matches });
}

/** Bracket seed order so 1 and 2 can only meet in the finals: 8 -> [1,8,4,5,2,7,3,6]. */
function seedOrder(n) {
  let order = [1];
  while (order.length < n) {
    const sum = order.length * 2 + 1;
    order = order.flatMap((s) => [s, sum - s]);
  }
  return order;
}

function startTopCut(t) {
  const eligible = computeStandings(t).filter((s) => !s.dropped);
  let size = t.topCut;
  while (size > eligible.length) size /= 2;
  if (size < 2) return toast('Not enough players for a top cut');
  const seeds = eligible.slice(0, size).map((s) => s.id);
  const order = seedOrder(size);
  const matches = [];
  for (let i = 0; i < order.length; i += 2) {
    matches.push({ id: uid(), table: i / 2 + 1, p1: seeds[order[i] - 1], p2: seeds[order[i + 1] - 1], g1: 0, g2: 0, done: false, seeds: [order[i], order[i + 1]] });
  }
  t.rounds.push({ type: 'top', matches });
  startNewRoundTimer(t);
}

function nextTopRound(t) {
  const prev = lastRound(t);
  const matches = [];
  for (let i = 0; i < prev.matches.length; i += 2) {
    const a = prev.matches[i], b = prev.matches[i + 1];
    const seedOf = (m) => (m.seeds ? m.seeds[winnerOf(m) === m.p1 ? 0 : 1] : null);
    let p = [[winnerOf(a), seedOf(a)], [winnerOf(b), seedOf(b)]];
    if (p[0][1] && p[1][1] && p[1][1] < p[0][1]) p = [p[1], p[0]]; // higher seed first
    matches.push({ id: uid(), table: i / 2 + 1, p1: p[0][0], p2: p[1][0], g1: 0, g2: 0, done: false, seeds: [p[0][1], p[1][1]] });
  }
  t.rounds.push({ type: 'top', matches });
  startNewRoundTimer(t);
}

function startNewRoundTimer(t) {
  t.timer = freshTimer(t.roundMinutes);
}

function champion(t) {
  if (t.phase !== 'done') return null;
  const r = lastRound(t);
  if (r?.type === 'top' && r.matches.length === 1) return winnerOf(r.matches[0]);
  return computeStandings(t)[0]?.id ?? null;
}

// ---------- season leaderboard --------------------------------------------

const nameKey = (name) => name.trim().toLowerCase();
const gamesPlayed = () => [...new Set(db.tournaments.map((t) => t.game || '').filter(Boolean))].sort();

/** Combine every started tournament into one ranking. Players are matched across events by name. */
function computeLeaderboard(game) {
  const L = new Map();
  const tours = db.tournaments
    .filter((t) => t.rounds.length && (!game || (t.game || '') === game))
    .sort((a, b) => a.created - b.created);

  for (const t of tours) {
    const rec = new Map(t.players.map((p) => [p.id, { w: 0, l: 0, d: 0 }]));
    for (const r of t.rounds) {
      for (const m of r.matches) {
        if (!m.done) continue;
        const a = rec.get(m.p1);
        if (!m.p2) { if (a) a.w++; continue; }
        const b = rec.get(m.p2);
        if (!a || !b) continue;
        const w = winnerOf(m);
        if (w === m.p1) { a.w++; b.l++; } else if (w === m.p2) { b.w++; a.l++; } else { a.d++; b.d++; }
      }
    }
    const top = t.rounds.find((r) => r.type === 'top');
    const cut = new Set(top ? top.matches.flatMap((m) => [m.p1, m.p2]) : []);
    const champ = champion(t);
    const standings = computeStandings(t);

    standings.forEach((s, i) => {
      const r = rec.get(s.id);
      if (!r || r.w + r.l + r.d === 0) return; // registered but never played
      const k = nameKey(s.name);
      if (!L.has(k)) L.set(k, { key: k, name: s.name, events: 0, w: 0, l: 0, d: 0, pts: 0, titles: 0, cuts: 0, history: [] });
      const e = L.get(k);
      e.name = s.name; // latest spelling wins
      e.events++;
      e.w += r.w; e.l += r.l; e.d += r.d;
      e.pts += WIN_PTS * r.w + DRAW_PTS * r.d;
      if (s.id === champ) e.titles++;
      if (cut.has(s.id)) e.cuts++;
      e.history.push({
        tid: t.id, name: t.name, date: t.created, rank: i + 1, of: standings.length,
        rec: r, champ: s.id === champ, cut: cut.has(s.id) ? top.matches.length * 2 : 0, done: t.phase === 'done',
      });
    });
  }

  const list = [...L.values()];
  for (const e of list) e.winPct = e.w / Math.max(1, e.w + e.l + e.d);
  const sorters = {
    pts: (a, b) => b.pts - a.pts || b.titles - a.titles || b.winPct - a.winPct,
    titles: (a, b) => b.titles - a.titles || b.cuts - a.cuts || b.pts - a.pts,
    winPct: (a, b) => b.winPct - a.winPct || b.pts - a.pts,
    events: (a, b) => b.events - a.events || b.pts - a.pts,
  };
  return list.sort((a, b) => sorters[ui.lbSort || 'pts'](a, b) || a.name.localeCompare(b.name));
}

// ---------- timer ----------------------------------------------------------

const timerRemaining = (t) => (t.timer.running ? t.timer.endsAt - Date.now() : t.timer.remaining);

function timerToggle(t) {
  if (t.timer.running) {
    t.timer.remaining = t.timer.endsAt - Date.now();
    t.timer.running = false;
  } else {
    t.timer.endsAt = Date.now() + t.timer.remaining;
    t.timer.running = true;
  }
  save();
  syncWakeLock();
}

function timerAdjust(t, ms) {
  if (t.timer.running) t.timer.endsAt += ms;
  else t.timer.remaining += ms;
  const r = timerRemaining(t);
  if (r > 0) t.timer.alarmed = false;
  if (r > WARN_MS) t.timer.warned = false;
  save();
}

let actx = null;
function unlockAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch (e) { /* audio unavailable */ }
}

function beep(times = 1) {
  if (!actx) return;
  const now = actx.currentTime;
  for (let i = 0; i < times; i++) {
    const start = now + i * 0.45;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
    osc.connect(gain).connect(actx.destination);
    osc.start(start);
    osc.stop(start + 0.34);
  }
}

const vibrate = (pattern) => { try { navigator.vibrate?.(pattern); } catch (e) { /* unsupported */ } };

function tick() {
  for (const t of db.tournaments) {
    if (!t.timer.running) continue;
    const r = timerRemaining(t);
    if (r <= WARN_MS && r > 0 && !t.timer.warned) {
      t.timer.warned = true;
      beep(2); vibrate([200, 100, 200]);
      toast('5 minutes left in the round');
      save();
    }
    if (r <= 0 && !t.timer.alarmed) {
      t.timer.alarmed = true;
      t.timer.warned = true;
      beep(6); vibrate([600, 200, 600, 200, 600]);
      toast('⏰ Time in round!');
      save();
    }
  }
  document.querySelectorAll('[data-timer]').forEach((el) => {
    const t = db.tournaments.find((x) => x.id === el.dataset.timer);
    if (!t) return;
    const r = timerRemaining(t);
    el.textContent = fmtTime(r);
    el.classList.toggle('over', r < 0);
    el.classList.toggle('warn', r >= 0 && r <= WARN_MS);
  });
}
setInterval(tick, 250);

let wakeLock = null;
async function syncWakeLock() {
  const want = !!(T()?.timer.running) && document.visibilityState === 'visible';
  try {
    if (want && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!want && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { syncWakeLock(); tick(); });

// ---------- rendering ------------------------------------------------------

function render() {
  const app = $('#app');
  const t = T();
  if (ui.screen === 'tournament' && t) {
    app.innerHTML = renderTournament(t) + (ui.modal ? renderModal(t) : '');
    $('.chip.on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  } else if (ui.screen === 'leaderboard') {
    app.innerHTML = renderLeaderboard();
  } else {
    ui.screen = 'home';
    ui.tid = null;
    app.innerHTML = renderHome();
  }
  if (dialog) app.insertAdjacentHTML('beforeend', renderDialog());
  tick();
}

function renderHome() {
  const list = [...db.tournaments].sort((a, b) => b.created - a.created).map((t) => {
    const status = t.phase === 'done' ? '<span class="badge done">DONE</span>'
      : t.phase === 'running' ? `<span class="badge live">${esc(roundLabel(lastRound(t)).toUpperCase())}</span>`
      : '<span class="badge">SETUP</span>';
    return `<button class="t-item" data-act="open-t" data-id="${t.id}">
      <strong>${esc(t.name)} ${status}</strong>
      <span>${t.game ? esc(t.game) + ' · ' : ''}${t.players.length} players · ${new Date(t.created).toLocaleDateString()}</span>
    </button>`;
  }).join('');

  const opt = (vals, sel, fmt = (v) => v) => vals.map((v) => `<option value="${v}"${v === sel ? ' selected' : ''}>${fmt(v)}</option>`).join('');

  return `
  <header class="bar"><h1><span class="brand">▲</span> TCG Tournament</h1></header>
  <main class="wrap" style="padding-bottom:32px">
    ${list ? `<button class="btn primary block" data-act="leaderboard" style="margin-bottom:20px">🏆 Season leaderboard</button>
    <h2 style="margin-bottom:10px">Your tournaments</h2>${list}` : ''}
    <form class="card" data-form="new-t" style="margin-top:${list ? 20 : 0}px">
      <h2>New tournament</h2>
      <label>Name<input name="name" required maxlength="60" placeholder="Friday Night Locals" autocomplete="off"></label>
      <label>Game<input name="game" list="games" maxlength="40" placeholder="Pokémon, Magic, One Piece…" autocomplete="off"></label>
      <datalist id="games">
        <option value="Pokémon TCG"><option value="Magic: The Gathering"><option value="Yu-Gi-Oh!">
        <option value="One Piece Card Game"><option value="Disney Lorcana"><option value="Flesh and Blood">
        <option value="Digimon Card Game"><option value="Star Wars: Unlimited">
      </datalist>
      <div class="row">
        <label>Round time (min)<input name="minutes" type="number" inputmode="numeric" min="1" max="240" value="50" required></label>
        <label>Best of<select name="bestOf">${opt([1, 3, 5], 3)}</select></label>
      </div>
      <div class="row">
        <label>Swiss rounds<select name="swiss"><option value="0" selected>Auto</option>${opt([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], -1)}</select></label>
        <label>Top cut<select name="topCut"><option value="0">None</option>${opt([2, 4, 8, 16, 32], 8, (v) => 'Top ' + v)}</select></label>
      </div>
      <button class="btn primary block">Create tournament</button>
    </form>
    <label class="btn block" style="margin:0;color:var(--text);font-size:1rem">
      Import tournament file
      <input type="file" accept="application/json,.json" data-import class="sr-only">
    </label>
    <details>
      <summary>Paste a copied backup</summary>
      <form data-form="import-text" style="margin-top:10px">
        <textarea name="json" id="import-json" placeholder="Paste backup text here"></textarea>
        <button class="btn block" style="margin-top:8px">Import</button>
      </form>
    </details>
    <p class="hint center">${cloud.col ? 'Tournaments are saved to your Claude account and on this device.' : 'Tournaments are saved on this device. Use Settings → Export to back one up.'}</p>
  </main>`;
}

function renderLeaderboard() {
  const games = gamesPlayed();
  if (ui.lbGame && !games.includes(ui.lbGame)) ui.lbGame = '';
  const lb = computeLeaderboard(ui.lbGame);
  const sort = ui.lbSort || 'pts';
  const events = db.tournaments.filter((t) => t.rounds.length && (!ui.lbGame || t.game === ui.lbGame)).length;

  const sorts = [['pts', 'Points'], ['titles', 'Titles'], ['winPct', 'Win %'], ['events', 'Events']];
  const chips = sorts.map(([k, label]) => `<button class="chip ${k === sort ? 'on' : ''}" data-act="lb-sort" data-k="${k}">${label}</button>`).join('');
  const gameSelect = games.length > 1 ? `
    <select data-lb-game aria-label="Filter by game" style="margin:0 0 12px">
      <option value="">All games</option>
      ${games.map((g) => `<option value="${esc(g)}"${g === ui.lbGame ? ' selected' : ''}>${esc(g)}</option>`).join('')}
    </select>` : '';

  const medal = ['🥇', '🥈', '🥉'];
  const podium = lb.length >= 3 ? `
    <div class="podium">
      ${[1, 0, 2].map((i) => `
        <button class="step s${i + 1}" data-act="lb-player" data-k="${esc(lb[i].key)}">
          <span class="medal">${medal[i]}</span>
          <strong>${esc(lb[i].name)}</strong>
          <span>${sortValue(lb[i], sort)}</span>
          <div class="block-bar"></div>
        </button>`).join('')}
    </div>` : '';

  const rows = lb.map((e, i) => `
    <tr data-act="lb-player" data-k="${esc(e.key)}" class="tap">
      <td>${i + 1}</td>
      <td>${esc(e.name)}${e.titles ? ` <span class="titles">🏆${e.titles > 1 ? '×' + e.titles : ''}</span>` : ''}</td>
      <td>${e.events}</td>
      <td>${e.w}-${e.l}-${e.d}</td>
      <td>${pct(e.winPct)}</td>
      <td class="pts">${e.pts}</td>
    </tr>`).join('');

  const body = lb.length ? `
    ${podium}
    <div class="card">
      <h2>${lb.length} players <span class="muted" style="font-size:.8rem;font-weight:400">· ${events} event${events === 1 ? '' : 's'}</span></h2>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Player</th><th>Ev</th><th>W-L-D</th><th>Win%</th><th>Pts</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="hint">Points: 3 per match win, 1 per draw, across every event (Swiss and top cut). Tap a player for their history. Players are matched by name, so spell names the same way each event.</p>
    </div>
    <button class="btn block" data-act="lb-share">Share leaderboard</button>`
    : '<p class="empty">No results yet.<br>Play a round in any tournament and it shows up here.</p>';

  return `
  <header class="bar">
    <button class="icon-btn" data-act="home" aria-label="Back">${ICON.back}</button>
    <h1>Season leaderboard<small>${ui.lbGame ? esc(ui.lbGame) : 'All tournaments'}</small></h1>
  </header>
  <main class="wrap" style="padding-bottom:32px">
    ${gameSelect}
    <div class="chips">${chips}</div>
    ${body}
  </main>
  ${ui.lbPlayer ? renderPlayerHistory(lb.find((e) => e.key === ui.lbPlayer)) : ''}`;
}

function sortValue(e, sort) {
  if (sort === 'titles') return `${e.titles} title${e.titles === 1 ? '' : 's'}`;
  if (sort === 'winPct') return pct(e.winPct) + '%';
  if (sort === 'events') return `${e.events} event${e.events === 1 ? '' : 's'}`;
  return `${e.pts} pts`;
}

function renderPlayerHistory(e) {
  if (!e) { ui.lbPlayer = null; return ''; }
  const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  const rows = [...e.history].reverse().map((h) => `
    <li>
      <span class="name" style="cursor:default">${esc(h.name)}<small class="muted" style="display:block;font-size:.75rem">${new Date(h.date).toLocaleDateString()} · ${h.rec.w}-${h.rec.l}-${h.rec.d}</small></span>
      <span class="badge ${h.champ ? 'done' : h.cut ? 'live' : ''}">${h.champ ? '🏆 CHAMPION' : h.cut ? 'TOP ' + h.cut : (h.done ? '' : 'LIVE · ') + ord(h.rank) + ' / ' + h.of}</span>
    </li>`).join('');
  return `
  <div class="modal-bg" data-act="lb-close">
    <div class="sheet" role="dialog" aria-label="${esc(e.name)} history">
      <h3>Player history</h3>
      <div style="text-align:center;margin:8px 0 14px"><strong style="font-size:1.3rem">${esc(e.name)}</strong></div>
      <div class="stat-row">
        <div><strong>${e.pts}</strong><span>Points</span></div>
        <div><strong>${e.w}-${e.l}-${e.d}</strong><span>Record</span></div>
        <div><strong>${pct(e.winPct)}%</strong><span>Win rate</span></div>
        <div><strong>${e.titles}</strong><span>Titles</span></div>
      </div>
      <ul class="list">${rows}</ul>
      <button class="btn block" data-act="lb-close" style="margin-top:12px">Close</button>
    </div>
  </div>`;
}

function renderTournament(t) {
  const sub = [t.game, t.phase === 'setup' ? 'Setup' : t.phase === 'done' ? 'Finished' : roundLabel(lastRound(t))].filter(Boolean).join(' · ');
  const tabs = [['players', 'Players'], ['round', 'Pairings'], ['standings', 'Standings'], ['timer', 'Timer']];
  const body = {
    players: renderPlayers, round: renderRound, standings: renderStandings, timer: renderTimer, settings: renderSettings,
  }[ui.tab] || renderPlayers;

  return `
  <header class="bar">
    <button class="icon-btn" data-act="home" aria-label="All tournaments">${ICON.back}</button>
    <h1>${esc(t.name)}<small>${esc(sub)}</small></h1>
    <button class="icon-btn" data-act="tab" data-tab="settings" aria-label="Settings" style="color:${ui.tab === 'settings' ? 'var(--accent)' : 'inherit'}">${ICON.gear}</button>
  </header>
  <main class="wrap">${body(t)}</main>
  <nav class="nav"><div class="nav-in">
    ${tabs.map(([k, label]) => `<button class="${ui.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${ICON[k === 'round' ? 'round' : k]}${label}</button>`).join('')}
  </div></nav>`;
}

function renderPlayers(t) {
  const started = t.rounds.length > 0;
  const inMatches = new Set();
  for (const r of t.rounds) for (const m of r.matches) { inMatches.add(m.p1); if (m.p2) inMatches.add(m.p2); }
  const active = t.players.filter((p) => !p.dropped).length;

  const rows = t.players.map((p, i) => `
    <li class="${p.dropped ? 'dropped' : ''}">
      <span class="num">${i + 1}</span>
      <button class="name" data-act="rename" data-id="${p.id}" title="Tap to rename">${esc(p.name)}</button>
      ${started ? `<button class="btn sm" data-act="drop" data-id="${p.id}">${p.dropped ? 'Re-enter' : 'Drop'}</button>` : ''}
      ${!inMatches.has(p.id) ? `<button class="btn sm danger" data-act="remove" data-id="${p.id}" aria-label="Remove ${esc(p.name)}">✕</button>` : ''}
    </li>`).join('');

  const rounds = plannedSwiss(t);
  const startCard = t.phase === 'setup' ? `
    <div class="card">
      <p class="muted" style="margin:0 0 12px">${t.players.length} players · ${t.swissRounds ? rounds : `${rounds} (auto)`} Swiss rounds · ${t.topCut ? 'Top ' + t.topCut : 'no top cut'} · Bo${t.bestOf} · ${t.roundMinutes} min</p>
      <button class="btn primary block" data-act="start" ${t.players.length < 2 ? 'disabled' : ''}>Start tournament &amp; pair Round 1</button>
    </div>` : '';

  return `
    ${startCard}
    <div class="card">
      <h2>Players <span class="badge">${active}${active !== t.players.length ? ' / ' + t.players.length : ''}</span></h2>
      <form class="add-row" data-form="add-player" style="margin-top:12px">
        <input id="player-input" name="name" list="known-players" placeholder="Add player name" maxlength="40" autocomplete="off" enterkeyhint="done" aria-label="Player name">
        <datalist id="known-players">${knownPlayers(t).map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
        <button class="btn primary">Add</button>
      </form>
      <details>
        <summary>Paste a list of players</summary>
        <form data-form="bulk-add" style="margin-top:10px">
          <textarea name="names" placeholder="One name per line"></textarea>
          <button class="btn block" style="margin-top:8px">Add all</button>
        </form>
      </details>
      ${started ? '<p class="hint">Players added now join from the next round. Dropped players won’t be paired again.</p>' : ''}
      ${rows ? `<ul class="list" style="margin-top:8px">${rows}</ul>` : '<p class="empty">No players yet</p>'}
    </div>`;
}

/** Names from other tournaments, so returning players keep the same spelling for the leaderboard. */
function knownPlayers(t) {
  const here = new Set(t.players.map((p) => nameKey(p.name)));
  const seen = new Map();
  for (const x of db.tournaments) for (const p of x.players) if (!here.has(nameKey(p.name))) seen.set(nameKey(p.name), p.name);
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

function renderRound(t) {
  if (!t.rounds.length) {
    return `<div class="empty">No rounds yet.<br><br><button class="btn primary" data-act="tab" data-tab="players">Add players &amp; start</button></div>`;
  }
  const idx = ui.roundIdx != null && ui.roundIdx < t.rounds.length ? ui.roundIdx : t.rounds.length - 1;
  const r = t.rounds[idx];
  const isLatest = idx === t.rounds.length - 1;
  const standings = computeStandings(t);
  const rec = new Map(standings.map((s) => [s.id, `${s.w}-${s.l}-${s.d}`]));

  const chips = t.rounds.map((rr, i) => `<button class="chip ${i === idx ? 'on' : ''}" data-act="pick-round" data-i="${i}">${esc(roundLabel(rr))}</button>`).join('');

  const done = r.matches.filter((m) => m.done).length;
  const matches = r.matches.map((m) => {
    const n1 = pname(t, m.p1), n2 = pname(t, m.p2);
    const names = esc((n1 + ' ' + n2).toLowerCase());
    const sub = (id, i) => (r.type === 'top' && m.seeds?.[i] ? `Seed ${m.seeds[i]}` : rec.get(id) || '');
    if (!m.p2) {
      return `<div class="match bye done" data-names="${names}">
        <span class="tbl">—</span><span class="p win">${esc(n1)}<small>${sub(m.p1, 0)}</small></span><span class="score">BYE</span></div>`;
    }
    const w = m.done ? winnerOf(m) : undefined;
    const cls = (id) => (w === undefined || w === null ? '' : w === id ? 'win' : 'lose');
    return `<button class="match ${m.done ? 'done' : ''}" data-act="open-match" data-r="${idx}" data-m="${m.id}" data-names="${names}">
      <span class="tbl">T${m.table}</span>
      <span class="p p1 ${cls(m.p1)}">${esc(n1)}<small>${sub(m.p1, 0)}</small></span>
      <span class="score">${m.done ? `${m.g1}–${m.g2}` : 'vs'}</span>
      <span class="p p2 ${cls(m.p2)}">${esc(n2)}<small>${sub(m.p2, 1)}</small></span>
    </button>`;
  }).join('');

  const timer = isLatest && t.phase === 'running' ? `
    <div class="mini-timer">
      <span class="clock" data-timer="${t.id}">--:--</span>
      <button class="btn sm" data-act="timer-toggle">${t.timer.running ? 'Pause' : 'Start'}</button>
      <button class="btn sm" data-act="tab" data-tab="timer">Full</button>
    </div>` : '';

  const champ = champion(t);
  const champCard = champ && isLatest ? `<div class="card champion"><div class="trophy">🏆</div><span class="muted">Champion</span><strong>${esc(pname(t, champ))}</strong></div>` : '';

  return `
    <div class="chips">${chips}</div>
    ${champCard}
    ${timer}
    <div class="muted" style="font-size:.85rem">${done} / ${r.matches.length} results in</div>
    <div class="progress"><div style="width:${(done / r.matches.length) * 100}%"></div></div>
    ${r.matches.length > 8 ? '<input type="search" placeholder="Find a player…" data-filter style="margin:0 0 12px" aria-label="Find a player">' : ''}
    <div id="matches">${matches}</div>
    ${isLatest ? renderRoundActions(t, r) : ''}`;
}

function renderRoundActions(t, r) {
  if (t.phase === 'done') {
    return `<div class="btns" style="margin-top:16px"><button class="btn" data-act="reopen">Reopen tournament</button></div>`;
  }
  const complete = roundComplete(r);
  const left = r.matches.filter((m) => !m.done).length;
  const out = [];
  if (!complete) {
    out.push(`<p class="hint center">Waiting on ${left} result${left === 1 ? '' : 's'} — tap a match to enter it.</p>`);
  } else if (r.type === 'swiss') {
    const played = swissRoundsPlayed(t);
    if (played < plannedSwiss(t)) {
      out.push(`<button class="btn primary block" data-act="next-swiss">Pair Round ${played + 1}</button>`);
    } else {
      if (t.topCut) out.push(`<button class="btn primary block" data-act="top-cut">Cut to Top ${t.topCut}</button>`);
      out.push(`<button class="btn ${t.topCut ? '' : 'primary'} block" data-act="finish">Finish tournament</button>`);
      out.push(`<button class="btn block" data-act="next-swiss">Add extra Swiss round</button>`);
    }
  } else if (r.matches.length > 1) {
    out.push(`<button class="btn primary block" data-act="next-top">Pair next bracket round</button>`);
  } else {
    out.push(`<button class="btn primary block" data-act="finish">Crown the champion 🏆</button>`);
  }
  out.push(`<button class="btn danger block sm" data-act="delete-round">Delete this round</button>`);
  return `<div class="stack" style="margin-top:16px">${out.join('')}</div>`;
}

function renderStandings(t) {
  const st = computeStandings(t);
  if (!st.length) return '<p class="empty">No players yet</p>';
  const cutLine = t.topCut && t.phase !== 'setup' ? t.topCut : 0;
  const champ = champion(t);
  const rows = st.map((s, i) => `
    <tr class="${s.dropped ? 'dropped' : ''} ${cutLine && i + 1 === cutLine ? 'cut' : ''}">
      <td>${i + 1}</td>
      <td>${esc(s.name)}${s.id === champ ? ' 🏆' : ''}</td>
      <td>${s.w}-${s.l}-${s.d}</td>
      <td class="pts">${s.mp}</td>
      <td>${pct(s.omw)}</td>
      <td>${pct(s.gwp)}</td>
      <td>${pct(s.ogw)}</td>
    </tr>`).join('');
  return `
    <div class="card">
      <h2>Standings <span class="muted" style="font-size:.8rem;font-weight:400">after ${swissRoundsPlayed(t)} Swiss round${swissRoundsPlayed(t) === 1 ? '' : 's'}</span></h2>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Player</th><th>W-L-D</th><th>Pts</th><th>OMW%</th><th>GW%</th><th>OGW%</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="hint">Win = 3 pts, draw = 1. Ties broken by opponents’ match-win %, game-win %, then opponents’ game-win % (33% minimum).${cutLine ? ' Dashed line = top cut.' : ''}</p>
    </div>
    <button class="btn block" data-act="share">Share standings</button>`;
}

function renderTimer(t) {
  const label = t.rounds.length ? roundLabel(lastRound(t)) : 'Round timer';
  return `
    <div class="big-timer">
      <div class="label">${esc(label)} · ${t.roundMinutes} min</div>
      <div class="clock" data-timer="${t.id}">--:--</div>
      <div class="btns"><button class="btn primary" data-act="timer-toggle">${t.timer.running ? 'Pause' : 'Start'}</button></div>
      <div class="btns">
        <button class="btn" data-act="timer-adj" data-ms="-60000">−1 min</button>
        <button class="btn" data-act="timer-adj" data-ms="60000">+1 min</button>
        <button class="btn" data-act="timer-adj" data-ms="300000">+5 min</button>
      </div>
      <div class="btns"><button class="btn danger" data-act="timer-reset">Reset to ${t.roundMinutes}:00</button></div>
      <p class="hint">Beeps &amp; vibrates at 5 minutes left and at time. The screen stays awake while the timer runs.</p>
    </div>`;
}

function renderSettings(t) {
  const opt = (vals, sel, fmt = (v) => v) => vals.map((v) => `<option value="${v}"${v === sel ? ' selected' : ''}>${fmt(v)}</option>`).join('');
  return `
    <form class="card" data-form="settings">
      <h2>Settings</h2>
      <label>Name<input name="name" required maxlength="60" value="${esc(t.name)}"></label>
      <label>Game<input name="game" maxlength="40" value="${esc(t.game || '')}"></label>
      <div class="row">
        <label>Round time (min)<input name="minutes" type="number" inputmode="numeric" min="1" max="240" value="${t.roundMinutes}" required></label>
        <label>Best of<select name="bestOf">${opt([1, 3, 5], t.bestOf)}</select></label>
      </div>
      <div class="row">
        <label>Swiss rounds<select name="swiss"><option value="0"${!t.swissRounds ? ' selected' : ''}>Auto (${t.plannedRounds || suggestedRounds(t.players.length)})</option>${opt([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], t.swissRounds)}</select></label>
        <label>Top cut<select name="topCut"><option value="0"${!t.topCut ? ' selected' : ''}>None</option>${opt([2, 4, 8, 16, 32], t.topCut, (v) => 'Top ' + v)}</select></label>
      </div>
      <button class="btn primary block">Save settings</button>
    </form>
    <div class="card stack">
      <h2>Data</h2>
      <button class="btn block" data-act="export">Export tournament (.json)</button>
      <button class="btn block" data-act="copy-backup">Copy backup text</button>
      <button class="btn danger block" data-act="delete-t">Delete tournament</button>
    </div>`;
}

function renderModal(t) {
  const r = t.rounds[ui.modal.r];
  const m = r?.matches.find((x) => x.id === ui.modal.m);
  if (!m) { ui.modal = null; return ''; }
  const need = gamesToWin(t);
  const n1 = pname(t, m.p1), n2 = pname(t, m.p2);
  const btn = (g1, g2) => `<button class="btn ${m.done && m.g1 === g1 && m.g2 === g2 ? 'on' : ''}" data-act="set-result" data-g1="${g1}" data-g2="${g2}">${g1}–${g2}</button>`;

  const p1Wins = [], p2Wins = [], draws = [];
  for (let b = 0; b < need; b++) p1Wins.push(btn(need, b));
  for (let a = 0; a < need; a++) p2Wins.push(btn(a, need));
  if (r.type === 'swiss') {
    // Unfinished matches at time: a game lead still wins; equal games is a draw.
    for (let g = need - 1; g >= 1; g--) for (let b = 0; b < g; b++) { p1Wins.push(btn(g, b)); p2Wins.push(btn(b, g)); }
    for (let g = need - 1; g >= 0; g--) draws.push(btn(g, g));
  }

  return `
  <div class="modal-bg" data-act="close-modal">
    <div class="sheet" role="dialog" aria-label="Enter result">
      <h3>${esc(roundLabel(r))} · Table ${m.table}</h3>
      <div class="vs"><span>${esc(n1)}</span><em>vs</em><span>${esc(n2)}</span></div>
      <div class="result-grid">
        <div class="col"><div class="col-h">${esc(n1)} wins</div>${p1Wins.join('')}</div>
        <div class="col"><div class="col-h">${draws.length ? 'Draw' : ''}</div>${draws.join('')}</div>
        <div class="col"><div class="col-h">${esc(n2)} wins</div>${p2Wins.join('')}</div>
      </div>
      <div class="btns">
        ${m.done ? '<button class="btn danger" data-act="clear-result">Clear result</button>' : ''}
        <button class="btn" data-act="close-modal">Cancel</button>
      </div>
    </div>
  </div>`;
}

// ---------- actions --------------------------------------------------------

function go(patch) {
  Object.assign(ui, patch);
  save();
  render();
  window.scrollTo(0, 0);
}

function shareText(t) {
  const st = computeStandings(t);
  const champ = champion(t);
  const lines = [`${t.name} — standings after ${swissRoundsPlayed(t)} round(s)`];
  if (champ) lines.push(`🏆 Champion: ${pname(t, champ)}`);
  st.forEach((s, i) => lines.push(`${i + 1}. ${s.name} ${s.w}-${s.l}-${s.d} (${s.mp} pts)${s.dropped ? ' [drop]' : ''}`));
  return lines.join('\n');
}

const actions = {
  home: () => go({ screen: 'home', tid: null, modal: null, lbPlayer: null }),
  leaderboard: () => go({ screen: 'leaderboard', tid: null, modal: null, lbPlayer: null }),
  'lb-sort': (el) => { ui.lbSort = el.dataset.k; render(); },
  'lb-player': (el) => { ui.lbPlayer = el.dataset.k; render(); },
  'lb-close': (el, e) => {
    if (el.classList.contains('modal-bg') && e.target !== el) return;
    ui.lbPlayer = null; render();
  },
  'lb-share': async () => {
    const lb = computeLeaderboard(ui.lbGame);
    const text = [`Season leaderboard${ui.lbGame ? ' — ' + ui.lbGame : ''}`,
      ...lb.map((e, i) => `${i + 1}. ${e.name} — ${e.pts} pts, ${e.w}-${e.l}-${e.d}, ${e.events} event${e.events === 1 ? '' : 's'}${e.titles ? ', 🏆×' + e.titles : ''}`)].join('\n');
    await shareOrCopy(text, 'Leaderboard');
  },
  'dlg-ok': () => {
    const d = dialog;
    const value = $('#dialog-input')?.value;
    dialog = null;
    d.onOk(value);
    render();
  },
  'dlg-cancel': (el, e) => {
    if (el.classList.contains('modal-bg') && e.target !== el) return;
    dialog = null; render();
  },
  'open-t': (el) => {
    const t = db.tournaments.find((x) => x.id === el.dataset.id);
    go({ screen: 'tournament', tid: t.id, tab: t.phase === 'setup' ? 'players' : 'round', roundIdx: null, modal: null });
  },
  tab: (el) => go({ tab: el.dataset.tab, roundIdx: null }),
  'pick-round': (el) => { ui.roundIdx = +el.dataset.i; render(); },

  rename: (el) => {
    const t = T(), p = playerById(t, el.dataset.id);
    openDialog({
      title: 'Rename player', input: p.name, okLabel: 'Save',
      onOk: (name) => { if (name && name.trim()) { p.name = name.trim().slice(0, 40); save(); } },
    });
  },
  drop: (el) => {
    const p = playerById(T(), el.dataset.id);
    p.dropped = !p.dropped; save(); render();
  },
  remove: (el) => {
    const t = T();
    t.players = t.players.filter((p) => p.id !== el.dataset.id); save(); render();
  },
  start: () => {
    const t = T();
    if (t.players.length < 2) return;
    t.phase = 'running';
    t.plannedRounds = suggestedRounds(t.players.length);
    pairSwissRound(t);
    startNewRoundTimer(t);
    go({ tab: 'round', roundIdx: null });
  },
  'next-swiss': () => {
    const t = T();
    if (t.players.filter((p) => !p.dropped).length < 2) return toast('Need at least 2 active players');
    pairSwissRound(t);
    startNewRoundTimer(t);
    go({ roundIdx: null });
  },
  'top-cut': () => { const t = T(); startTopCut(t); go({ roundIdx: null }); },
  'next-top': () => { const t = T(); nextTopRound(t); go({ roundIdx: null }); },
  finish: () => {
    const t = T();
    t.phase = 'done';
    t.timer.running = false;
    save(); render(); syncWakeLock();
  },
  reopen: () => { const t = T(); t.phase = 'running'; save(); render(); },
  'delete-round': () => {
    const t = T();
    openDialog({
      title: 'Delete round', message: `Delete ${roundLabel(lastRound(t))} and all its results?`, okLabel: 'Delete round', danger: true,
      onOk: () => {
        t.rounds.pop();
        if (!t.rounds.length) t.phase = 'setup';
        startNewRoundTimer(t);
        go({ roundIdx: null, tab: t.rounds.length ? 'round' : 'players' });
      },
    });
  },

  'open-match': (el) => {
    const t = T(), ri = +el.dataset.r;
    if (t.rounds[ri].type === 'top' && ri !== t.rounds.length - 1) return toast('Later bracket rounds already paired — delete them to edit this');
    ui.modal = { r: ri, m: el.dataset.m }; render();
  },
  'close-modal': (el, e) => {
    if (el.classList.contains('modal-bg') && e.target !== el) return;
    ui.modal = null; render();
  },
  'set-result': (el) => {
    const t = T(), m = t.rounds[ui.modal.r].matches.find((x) => x.id === ui.modal.m);
    m.g1 = +el.dataset.g1; m.g2 = +el.dataset.g2; m.done = true;
    ui.modal = null; save(); render();
    if (roundComplete(t.rounds[t.rounds.length - 1])) toast('All results in ✔');
  },
  'clear-result': () => {
    const t = T(), m = t.rounds[ui.modal.r].matches.find((x) => x.id === ui.modal.m);
    m.g1 = 0; m.g2 = 0; m.done = false;
    ui.modal = null; save(); render();
  },

  'timer-toggle': () => { timerToggle(T()); render(); },
  'timer-adj': (el) => { timerAdjust(T(), +el.dataset.ms); tick(); },
  'timer-reset': () => {
    const t = T();
    openDialog({
      title: 'Reset timer', message: `Set the clock back to ${t.roundMinutes}:00?`, okLabel: 'Reset', danger: true,
      onOk: () => { startNewRoundTimer(t); save(); syncWakeLock(); },
    });
  },

  share: async () => {
    await shareOrCopy(shareText(T()), 'Standings');
  },
  export: async () => {
    const t = T();
    const json = JSON.stringify(t, null, 2);
    const filename = `${t.name.replace(/[^\w-]+/g, '_') || 'tournament'}.json`;
    const downloads = window.claude?.use ? await window.claude.use('downloads') : null;
    if (downloads) {
      try { await downloads.save({ filename, data: json }); } catch (e) {
        if (e?.code !== 'declined') toast('Could not save the file. Use Copy backup text instead.');
      }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  'copy-backup': async () => {
    await shareOrCopy(JSON.stringify(T()), 'Backup');
  },
  'delete-t': () => {
    const t = T();
    openDialog({
      title: 'Delete tournament', message: `Delete “${t.name}” and all its results? This cannot be undone.`, okLabel: 'Delete', danger: true,
      onOk: () => {
        db.tournaments = db.tournaments.filter((x) => x.id !== t.id);
        go({ screen: 'home', tid: null });
      },
    });
  },
};

const forms = {
  dlg: () => actions['dlg-ok'](),
  'import-text': (f) => {
    try { importTournament(JSON.parse(f.json.value)); } catch (err) { toast('That text is not a tournament backup'); }
  },
  'new-t': (f) => {
    const t = newTournament({
      name: f.name.value.trim(),
      game: f.game.value.trim(),
      roundMinutes: Math.max(1, +f.minutes.value || 50),
      bestOf: +f.bestOf.value,
      swissRounds: +f.swiss.value,
      topCut: +f.topCut.value,
    });
    db.tournaments.push(t);
    go({ screen: 'tournament', tid: t.id, tab: 'players' });
    $('#player-input')?.focus();
  },
  'add-player': (f) => {
    const name = f.name.value.trim();
    if (!name) return;
    const t = T();
    if (t.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return toast(`${name} is already registered`);
    t.players.push({ id: uid(), name: name.slice(0, 40), dropped: false });
    save(); render();
    $('#player-input')?.focus();
  },
  'bulk-add': (f) => {
    const t = T();
    const existing = new Set(t.players.map((p) => p.name.toLowerCase()));
    let added = 0;
    for (const raw of f.names.value.split(/\r?\n/)) {
      const name = raw.replace(/^\s*\d+[.)]\s*/, '').trim().slice(0, 40); // strip "1. " numbering
      if (!name || existing.has(name.toLowerCase())) continue;
      existing.add(name.toLowerCase());
      t.players.push({ id: uid(), name, dropped: false });
      added++;
    }
    save(); render();
    toast(`Added ${added} player${added === 1 ? '' : 's'}`);
  },
  settings: (f) => {
    const t = T();
    const minutes = Math.max(1, +f.minutes.value || t.roundMinutes);
    Object.assign(t, {
      name: f.name.value.trim() || t.name,
      game: f.game.value.trim(),
      bestOf: +f.bestOf.value,
      swissRounds: +f.swiss.value,
      topCut: +f.topCut.value,
    });
    if (minutes !== t.roundMinutes) {
      t.roundMinutes = minutes;
      if (!t.timer.running) t.timer = freshTimer(minutes);
    }
    save(); render();
    toast('Settings saved');
  },
};

document.addEventListener('click', (e) => {
  unlockAudio(); // browsers only allow sound after a user gesture
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el, e);
});

document.addEventListener('submit', (e) => {
  const fn = forms[e.target.dataset.form];
  if (!fn) return;
  e.preventDefault();
  fn(e.target);
});

document.addEventListener('input', (e) => {
  if (!e.target.matches('[data-filter]')) return;
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll('#matches .match').forEach((m) => {
    m.style.display = !q || m.dataset.names.includes(q) ? '' : 'none';
  });
});

document.addEventListener('change', async (e) => {
  if (e.target.matches('[data-lb-game]')) { ui.lbGame = e.target.value; render(); return; }
  if (!e.target.matches('[data-import]')) return;
  const file = e.target.files[0];
  if (!file) return;
  try {
    importTournament(JSON.parse(await file.text()));
  } catch (err) {
    toast('That file is not a valid tournament export');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (ui.modal || ui.lbPlayer || dialog)) { ui.modal = null; ui.lbPlayer = null; dialog = null; render(); }
});

// ---------- boot -----------------------------------------------------------

render();
syncWakeLock();
initCloud();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable */ });
}
