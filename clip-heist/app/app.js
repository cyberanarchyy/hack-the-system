// Clip Heist — turn long gameplay recordings into YouTube Shorts on your phone.
(() => {
  'use strict';

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const app = $('#app');
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fmt = (s, tenths = false) => {
    if (!Number.isFinite(s)) return '0:00';
    s = Math.max(0, s);
    const m = Math.floor(s / 60);
    const sec = s - m * 60;
    return tenths ? `${m}:${sec.toFixed(1).padStart(4, '0')}` : `${m}:${String(Math.floor(sec)).padStart(2, '0')}`;
  };
  const fmtSize = (b) => (b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(0) + ' MB' : Math.ceil(b / 1e3) + ' KB');
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function modal(html, { onMount } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    if (onMount) onMount(wrap, close);
    return { el: wrap, close };
  }

  function confirmBox(title, body, okLabel = 'Delete', danger = true) {
    return new Promise((resolve) => {
      modal(`<h2>${esc(title)}</h2><p class="muted">${esc(body)}</p>
        <div class="row gap"><button class="btn ghost" data-x="no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-x="yes">${esc(okLabel)}</button></div>`, {
        onMount(el, close) {
          el.addEventListener('click', (e) => {
            const x = e.target.closest('[data-x]');
            if (x) { close(); resolve(x.dataset.x === 'yes'); }
            else if (e.target === el) { close(); resolve(false); }
          });
        },
      });
    });
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copied'); }
    catch { toast('Couldn’t copy — long-press the text instead'); }
  }

  const ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4.5" height="16" rx="1.2"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.2"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/></svg>',
    lib: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4-2.5z" fill="currentColor"/></svg>',
    clips: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10 18h4"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  };

  const TAG_LABEL = { boom: '💥 Boom', loud: '🔊 Loud', chaos: '🏎️ Chaos', flash: '⚡ Flash' };

  // ---------- content ideas ----------
  const HOOKS = {
    boom: ['WAIT FOR IT… 💥', 'THAT ESCALATED FAST', 'HE DID NOT SEE THAT COMING', 'BIGGEST BOOM YET?', 'WORST DAY EVER'],
    chaos: ['FULL SEND 🏎️', 'PURE CHAOS', 'THE COPS GAVE UP', 'NO BRAKES. NO PLAN.', 'CLEANEST ESCAPE EVER?'],
    loud: ['TURN YOUR SOUND ON 🔊', 'HIS REACTION 💀', 'CHAT WENT CRAZY', 'LISTEN TO THIS…'],
    any: ['THIS GAME IS UNREAL', 'NO WAY THAT WORKED', 'RATE THIS 1–10', 'I CAN’T BELIEVE THIS HAPPENED', 'WATCH TILL THE END', 'THE PHYSICS IN THIS GAME…', 'CLIP OF THE YEAR?'],
  };
  const PAYOFFS = ['💀💀💀', 'NAH 😭', 'BRO WHAT', 'UNREAL 🔥', 'CALCULATED.', 'RIP 🪦', 'NOT LIKE THIS'];
  const TITLES_ANY = [
    '{hook}', 'Nobody expected this 😳', 'I can’t stop replaying this', 'Most chaotic 20 seconds ever',
    'The timing on this 💀', 'Did that really just happen?', 'Wait for the ending…', 'This is why I clip everything',
  ];
  const TITLES_GAME = [
    '{hook} | {game}', '{game} moments that hit different', '{game} but nothing goes to plan',
    '{game} physics are actually insane', 'Did that really just happen in {game}?', 'Best {game} clip this week?',
  ];

  function suggestHook(tags) {
    const pool = [...HOOKS.any];
    for (const t of tags || []) if (HOOKS[t]) pool.push(...HOOKS[t], ...HOOKS[t]);
    return pick(pool);
  }
  const titleCase = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
  function suggestTitle(clip) {
    const hook = titleCase((clip.text.hook || '').replace(/[^\w\s’'?!]/g, '').trim());
    const game = (settings.game || '').trim();
    let t = pick(game ? [...TITLES_GAME, ...TITLES_ANY] : TITLES_ANY);
    if (t.includes('{hook}') && !hook) t = game ? '{game} moments that hit different' : 'Nobody expected this 😳';
    t = t.replace('{hook}', hook).replace(/\{game\}/g, game);
    return (t + ' #shorts').slice(0, 100);
  }
  function suggestDescription(clip) {
    const tags = settings.hashtags.trim();
    const what = (settings.game || '').trim() ? `${settings.game.trim()} clips` : 'clips';
    const handle = settings.handle ? `\nFollow ${settings.handle} for daily ${what} 🎮` : '';
    return `${clip.post.title || suggestTitle(clip)}${handle}\n\n${tags}`;
  }

  // ---------- state ----------
  const DEFAULT_SETTINGS = {
    handle: '', game: '', preRoll: 12, postRoll: 5, quality: '1080', fps: 30,
    hashtags: '#gaming #gamingclips #clips #shorts',
    template: {
      frame: { layout: 'fill', zoom: 1, panX: 0.5, panY: 0.5 },
      text: { style: 'classic', size: 86, y: 0.17, payoffStyle: 'gold', payoffY: 0.72, capStyle: 'boxed', capSize: 66, capY: 0.6, capPop: true, capUpper: true },
      fx: { punch: true, slowmo: false, shake: false, flash: false, progress: true },
      speed: 1, autoHook: true,
    },
  };
  let settings = structuredClone(DEFAULT_SETTINGS);
  let sources = [];
  let clips = [];
  const scanning = {}; // sourceId -> { p, msg }
  let view = { name: 'library' };
  const objectUrls = new Map(); // sourceId -> blob url
  let exporting = false;

  async function sourceUrl(id) {
    if (objectUrls.has(id)) return objectUrls.get(id);
    const blob = await DB.get('blobs', 'src:' + id);
    if (!blob) throw new Error('Video file is missing.');
    const url = URL.createObjectURL(blob);
    objectUrls.set(id, url);
    return url;
  }

  const saveSettings = () => DB.put('kv', settings, 'settings');
  const saveSource = (s) => DB.put('sources', s);
  const saveClip = (c) => DB.put('clips', c);

  // ---------- Free vs Pro ----------
  const isPro = () => Plan.isPro();
  const LOCK = '🔒';
  const UPSELL = {
    highlights: ['Unlock every highlight', 'Free shows your top 3 moments. Pro unlocks all of them.'],
    length: ['Scan full sessions', 'Free scans the first 10 minutes of a video. Pro scans hours-long streams and sessions.'],
    batch: ['Make & export in bulk', 'Turn every highlight into a short, and export them all, in one tap.'],
    exports: ['You’ve used your free exports', 'Free includes 3 exports a week. Pro is unlimited.'],
    long: ['Longer shorts', 'Free shorts can be up to 30 seconds. Pro goes up to 3 minutes.'],
    quality: ['Export in 1080p / 60 fps', 'Free exports are 720p with a watermark. Pro is full quality, no watermark.'],
    watermark: ['Remove the watermark', 'Pro exports are clean, full 1080p, with no end card.'],
    stream: ['Streamer layout', 'Facecam on top, gameplay below: the format every stream clip channel uses.'],
    styles: ['All text styles', 'Gold, Neon, Sunset, Boxed and Alert styles for hooks and captions.'],
    payoff: ['Reaction text', 'Pop a reaction like “NAH 😭” on screen exactly when the big moment hits.'],
    captions: ['Captions', 'Timed, pop-in captions that keep people watching (auto-captions from speech coming soon).'],
    fx: ['Pro effects', 'Slow-mo, camera shake and flash on the hit, plus speed control.'],
    template: ['Saved templates', 'Save your look once and every new short starts with it.'],
    features: ['This short uses Pro features', ''],
  };
  const PRO_PERKS = ['All highlights, full-length scans', 'Unlimited exports in 1080p / 60 fps, no watermark', 'Streamer layout (facecam + gameplay)', 'Captions, reaction text and all styles', 'Slow-mo, shake, flash, speed control', 'Bulk make & export, saved templates'];

  // ---------- account & payments ----------
  let payments = null; // { payments, login, prices } from the server, or false if there is no server
  async function api(path, data) {
    const res = await fetch('/api/' + path, { method: data ? 'POST' : 'GET', headers: data ? { 'content-type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined });
    let out = {};
    try { out = await res.json(); } catch {}
    if (!res.ok) throw new Error(out.error || 'Something went wrong. Please try again.');
    return out;
  }
  async function loadPayments() {
    if (payments !== null) return payments;
    try { payments = await api('health'); } catch { payments = false; }
    return payments;
  }
  const canBuy = (plan) => !!(payments && payments.payments && payments.prices && payments.prices[plan]);

  async function startCheckout(plan) {
    await loadPayments();
    if (!canBuy(plan)) { toast('Checkout is unavailable right now. Please try again shortly.'); return; }
    toast('Opening secure checkout…');
    try {
      const acct = Plan.account();
      const { url } = await api('checkout', { plan, email: acct && acct.email });
      location.href = url;
    } catch (e) { toast(e.message); }
  }

  function saveAccount(a) { Plan.setAccount(a); }

  async function refreshAccount(force = false) {
    const a = Plan.account();
    if (!a || !a.pass) return;
    if (!force && Date.now() - (a.checkedAt || 0) < 864e5) return; // at most daily
    try { saveAccount(await api('me', { pass: a.pass })); }
    catch (e) { if (/sign in/i.test(e.message)) saveAccount(null); }
  }

  // Coming back from Stripe checkout or a sign-in email.
  async function handleReturn() {
    const q = new URLSearchParams(location.search);
    const clean = () => history.replaceState(null, '', location.pathname + location.hash);
    if (q.get('checkout') === 'cancelled') { clean(); toast('Checkout cancelled. No charge was made.'); return; }
    const sid = q.get('checkout'), login = q.get('login'), buy = q.get('buy');
    if (sid || login) {
      clean();
      const m = modal('<div class="upsell"><div class="pro-badge">PRO</div><h2>Unlocking Pro…</h2><p class="muted">One second.</p></div>');
      try {
        const a = await api(sid ? 'checkout/complete' : 'login/verify', sid ? { sessionId: sid } : { token: login });
        saveAccount(a);
        m.close();
        if (a.pro) welcomePro(a); else toast('No active Pro plan found for ' + (a.email || 'this account'));
        render();
      } catch (e) { m.close(); toast(e.message); }
    } else if (buy) { clean(); startCheckout(buy); }
  }

  function welcomePro(a) {
    modal(`<div class="upsell"><div class="pro-badge">PRO</div><h2>Welcome to Clip Heist Pro 🎉</h2>
      <p class="muted">${a.status === 'trialing' ? 'Your 7-day free trial has started. ' : ''}Everything is unlocked: every highlight, 1080p/60 exports with no watermark, streamer layout, captions and all effects.</p>
      <button class="btn primary block" data-x="ok">Start clipping</button></div>`, {
      onMount(el, close) { el.addEventListener('click', (e) => { if (e.target.closest('[data-x]') || e.target === el) close(); }); },
    });
  }

  function restoreModal() {
    modal(`<div class="upsell"><h2>Restore your purchase</h2>
      <p class="muted">Enter the email you paid with. We’ll send a link that unlocks Pro on this device.</p>
      <input class="cap-text" id="rs-email" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com">
      <button class="btn primary block" data-x="send">Email me a link</button>
      <button class="btn ghost block" data-x="no">Cancel</button></div>`, {
      onMount(el, close) {
        el.addEventListener('click', async (e) => {
          const x = e.target.closest('[data-x]');
          if (!x) { if (e.target === el) close(); return; }
          if (x.dataset.x === 'no') return close();
          const email = el.querySelector('#rs-email').value.trim();
          x.disabled = true; x.textContent = 'Sending…';
          try { await api('login', { email }); close(); toast('Check your email for the link 📩'); }
          catch (err) { toast(err.message); x.disabled = false; x.textContent = 'Email me a link'; }
        });
      },
    });
  }

  async function openPortal() {
    const a = Plan.account();
    if (!a) return;
    toast('Opening billing…');
    try { const { url } = await api('portal', { pass: a.pass }); location.href = url; } catch (e) { toast(e.message); }
  }

  function upsell(reason, extra = '') {
    const [title, body] = UPSELL[reason] || UPSELL.features;
    modal(`
      <div class="upsell">
        <div class="pro-badge">PRO</div>
        <h2>${esc(title)}</h2>
        <p class="muted">${esc(body)}${extra}</p>
        <ul class="perks">${PRO_PERKS.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <button class="btn primary block" data-x="buy" data-plan="month">Get Pro · $6.99/month</button>
        <button class="btn block" data-x="buy" data-plan="year">Yearly · $49 <span class="save-tag">save 41%</span></button>
        <button class="link" data-x="buy" data-plan="lifetime">Or $79 once for lifetime Pro</button>
        <button class="link muted-link" data-x="restore">Already paid? Restore purchase</button>
        ${devMode() ? '<button class="btn block" data-x="dev">🧪 Test: turn on Pro</button>' : ''}
        <button class="btn ghost block" data-x="no">Not now</button>
      </div>`, {
      onMount(el, close) {
        el.addEventListener('click', (e) => {
          const x = e.target.closest('[data-x]');
          if (!x && e.target !== el) return;
          if (x && x.dataset.x === 'buy') { close(); startCheckout(x.dataset.plan); return; }
          if (x && x.dataset.x === 'restore') { close(); restoreModal(); return; }
          if (x && x.dataset.x === 'dev') { Plan.setPro(true); toast('Pro test mode on'); close(); render(); return; }
          close();
        });
      },
    });
  }

  // Which Pro-only things a short uses (checked before a free export).
  function proFeaturesUsed(c) {
    const out = [];
    if (c.frame.layout === 'stream') out.push('streamer layout');
    if (c.text.style !== 'classic' && c.text.hook) out.push(Render.STYLES[c.text.style]?.label + ' text style');
    if (c.text.payoff) out.push('reaction text');
    if ((c.captions || []).some((x) => x.text)) out.push('captions');
    if (c.fx.slowmo) out.push('slow-mo');
    if (c.fx.shake) out.push('camera shake');
    if (c.fx.flash) out.push('flash');
    if ((c.speed || 1) !== 1) out.push('speed change');
    return out;
  }

  const devMode = () => localStorage.getItem('clip-heist-dev') === '1';

  // ---------- navigation ----------
  function go(name, params = {}) {
    teardownEditor();
    view = { name, ...params };
    history.replaceState(null, '', '#' + name + (params.id ? '/' + params.id : ''));
    render();
    window.scrollTo(0, 0);
  }

  function nav() {
    const tab = (name, label, icon, n) => `<button class="tab ${view.name === name ? 'on' : ''}" data-act="go" data-to="${name}">${icon}<span>${label}${n ? ` <b>${n}</b>` : ''}</span></button>`;
    return `<nav class="nav">${tab('library', 'Gameplay', ICON.lib)}${tab('clips', 'Shorts', ICON.clips, clips.length || '')}${tab('settings', 'Settings', ICON.gear)}</nav>`;
  }

  function render() {
    if (view.name === 'source') return renderSource();
    if (view.name === 'editor') return renderEditor();
    if (view.name === 'clips') return renderClips();
    if (view.name === 'settings') return renderSettings();
    return renderLibrary();
  }

  // ---------- library ----------
  function renderLibrary() {
    const list = [...sources].sort((a, b) => b.addedAt - a.addedAt);
    app.innerHTML = `
      <header class="bar"><h1><span class="brand">Clip</span> Heist<small>Gameplay &amp; streams → Shorts</small></h1></header>
      <main class="wrap">
        <label class="drop">
          <input type="file" accept="video/*" multiple hidden id="file">
          <div class="drop-icon">＋</div>
          <div><b>Import gameplay</b><br><span class="muted">Pick recordings from your camera roll or files. The app finds the best moments for you.</span></div>
        </label>
        ${list.length ? '' : `
        <div class="card how">
          <h2>Getting your footage in</h2>
          <ol>
            <li><b>PC:</b> drop in an OBS or ShadowPlay recording, or a stream VOD.</li>
            <li><b>Streams:</b> download your VOD from Twitch (Creator Dashboard → Content → Video Producer) or Kick, then import it.</li>
            <li><b>PS5 / Xbox:</b> save a capture, then get it from the PS App or Xbox app onto your phone or PC.</li>
          </ol>
          <p class="hint">Clip your own footage, or streams you have permission to clip. Lots of streamers run clipping programs that pay clippers.</p>
        </div>`}
        ${list.map(sourceCard).join('')}
      </main>
      ${nav()}`;
    $('#file').addEventListener('change', (e) => importFiles([...e.target.files]));
  }

  function sourceCard(s) {
    const sc = scanning[s.id];
    const status = sc
      ? `<div class="progress"><i style="width:${Math.round(sc.p * 100)}%"></i></div><span class="muted small">${esc(sc.msg)} ${Math.round(sc.p * 100)}%</span>`
      : s.status === 'error' ? `<span class="bad small">${esc(s.error || 'Scan failed')}</span>`
      : s.status === 'ready' ? `<span class="small"><b class="accent">${s.highlights.length}</b> highlights · ${fmt(s.duration)} · ${fmtSize(s.size)}</span>`
      : '<span class="muted small">Waiting to scan…</span>';
    const nClips = clips.filter((c) => c.sourceId === s.id).length;
    return `<div class="card src" data-act="open-source" data-id="${s.id}">
      <div class="thumb">${s.thumb ? `<img src="${s.thumb}" alt="">` : '<div class="ph">🎮</div>'}</div>
      <div class="meta"><b class="name">${esc(s.name)}</b>${status}${nClips ? `<span class="muted small">${nClips} short${nClips > 1 ? 's' : ''} made</span>` : ''}</div>
    </div>`;
  }

  async function importFiles(files) {
    files = files.filter((f) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name));
    if (!files.length) return toast('Pick a video file');
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    for (const f of files) {
      const s = {
        id: uid(), name: f.name.replace(/\.[^.]+$/, ''), size: f.size, type: f.type, addedAt: Date.now(),
        status: 'new', highlights: [], curve: [], thumb: null, duration: 0,
      };
      try {
        await DB.put('blobs', f, 'src:' + s.id);
      } catch (e) {
        toast('Not enough storage for ' + f.name);
        continue;
      }
      sources.push(s);
      await saveSource(s);
      scanQueue.push(s.id);
    }
    render();
    runScans();
  }

  const scanQueue = [];
  let scanRunning = false;
  async function runScans() {
    if (scanRunning) return;
    scanRunning = true;
    while (scanQueue.length) {
      const id = scanQueue.shift();
      const s = sources.find((x) => x.id === id);
      if (!s) continue;
      await scanSource(s);
    }
    scanRunning = false;
  }

  async function scanSource(s) {
    scanning[s.id] = { p: 0, msg: 'Starting…' };
    s.status = 'scanning';
    // If the page died mid-scan (usually the phone running out of memory on a big file),
    // retry without the memory-hungry sound analysis, and give up after a few tries.
    s.scanAttempts = (s.scanAttempts || 0) + 1;
    await saveSource(s);
    refreshScanUI(s);
    try {
      if (s.scanAttempts > 3) throw new Error('This video keeps crashing the scan. Trim it to under 10 minutes in Photos and import it again.');
      const blob = await DB.get('blobs', 'src:' + s.id);
      if (!blob) throw new Error('Video file is missing. Import it again.');
      let last = 0;
      const res = await Analyzer.run(blob, { ...settings, skipAudio: s.scanAttempts > 1, maxDuration: isPro() ? Infinity : Plan.LIMITS.maxSourceSeconds }, (p, msg) => {
        scanning[s.id] = { p, msg };
        if (performance.now() - last > 250) { last = performance.now(); refreshScanUI(s); }
      });
      Object.assign(s, res, { status: 'ready', error: null, scanAttempts: 0 });
      if (!res.audioAnalyzed) s.note = 'Sound couldn’t be analyzed, so highlights are based on the picture only.';
      else s.note = null;
    } catch (e) {
      console.error(e);
      s.status = 'error';
      s.error = e.message || 'Scan failed';
    }
    delete scanning[s.id];
    await saveSource(s);
    if ((view.name === 'library') || (view.name === 'source' && view.id === s.id)) render();
    if (s.status === 'ready') toast(`Found ${s.highlights.length} highlights in ${s.name}`);
  }

  function refreshScanUI(s) {
    if (view.name === 'library') {
      const el = document.querySelector(`.src[data-id="${s.id}"]`);
      if (el) el.outerHTML = sourceCard(s);
    } else if (view.name === 'source' && view.id === s.id) {
      const el = $('#scanbox');
      const sc = scanning[s.id];
      if (el && sc) el.innerHTML = `<div class="progress"><i style="width:${Math.round(sc.p * 100)}%"></i></div><p class="muted small">${esc(sc.msg)} ${Math.round(sc.p * 100)}%</p>`;
      else render();
    }
  }

  // ---------- source (highlights) ----------
  async function renderSource() {
    const s = sources.find((x) => x.id === view.id);
    if (!s) return go('library');
    const sc = scanning[s.id];
    const mine = clips.filter((c) => c.sourceId === s.id);
    app.innerHTML = `
      <header class="bar">
        <button class="icon-btn" data-act="go" data-to="library" aria-label="Back">${ICON.back}</button>
        <h1>${esc(s.name)}<small>${s.duration ? fmt(s.duration) + ' · ' : ''}${fmtSize(s.size)}</small></h1>
        <button class="icon-btn" data-act="del-source" data-id="${s.id}" aria-label="Delete">${ICON.trash}</button>
      </header>
      <main class="wrap">
        <div class="player"><video id="player" controls playsinline preload="metadata"></video></div>
        ${s.curve && s.curve.length ? `<canvas class="heat" id="heat" height="44"></canvas><p class="hint center">Hotter = more action. Tap to jump there.</p>` : ''}
        <div class="row gap">
          <button class="btn primary" data-act="clip-here">✂️ Clip from here</button>
          ${s.status === 'ready' && s.highlights.length ? `<button class="btn" data-act="auto-all">${isPro() ? '' : LOCK + ' '}⚡ Make all ${s.highlights.length}</button>` : ''}
        </div>
        <div id="scanbox">${sc ? `<div class="progress"><i style="width:${Math.round(sc.p * 100)}%"></i></div><p class="muted small">${esc(sc.msg)}</p>` : ''}</div>
        ${s.status === 'error' ? `<div class="card"><p class="bad">${esc(s.error)}</p><button class="btn" data-act="rescan">Try again</button></div>` : ''}
        ${s.note ? `<p class="hint">${esc(s.note)}</p>` : ''}
        ${s.status === 'ready' && s.scanned && s.scanned < s.duration - 1 ? (isPro()
          ? `<div class="card notice"><span>Scanned the first ${fmt(s.scanned)} on the free plan.</span><button class="btn sm primary" data-act="rescan">Scan full video</button></div>`
          : `<div class="card notice"><span>Free scans the first 10 minutes of ${fmt(s.duration)}.</span><button class="btn sm" data-act="upsell" data-r="length">${LOCK} Scan all</button></div>`) : ''}
        ${s.status === 'ready' ? `
          <div class="section-h"><h2>Top moments ${!isPro() && s.highlights.length > Plan.LIMITS.unlockedHighlights ? `<small class="muted">${s.highlights.length} found · ${Plan.LIMITS.unlockedHighlights} unlocked</small>` : ''}</h2><button class="link" data-act="rescan">Rescan</button></div>
          ${s.highlights.length ? s.highlights.map((h, i) => {
            const made = mine.find((c) => c.highlightId === h.id);
            if (!isPro() && i >= Plan.LIMITS.unlockedHighlights) {
              return `<div class="card hl locked" data-act="upsell" data-r="highlights">
                <div class="hl-thumb"><img src="${h.thumb}" alt=""><span>${LOCK}</span></div>
                <div class="hl-meta"><b>#${i + 1}</b> <span class="muted small">${fmt(h.start)}–${fmt(h.end)}</span>
                  <div class="tags">${h.tags.map((t) => `<span class="tag">${TAG_LABEL[t] || t}</span>`).join('')}</div>
                  <button class="btn sm pro">${LOCK} Unlock with Pro</button></div>
              </div>`;
            }
            return `<div class="card hl">
              <button class="hl-thumb" data-act="preview-hl" data-i="${i}"><img src="${h.thumb}" alt=""><span>${fmt(h.peak)}</span></button>
              <div class="hl-meta">
                <b>#${i + 1}</b> <span class="muted small">${fmt(h.start)}–${fmt(h.end)}</span>
                <div class="tags">${h.tags.map((t) => `<span class="tag">${TAG_LABEL[t] || t}</span>`).join('') || '<span class="tag">🎬 Action</span>'}</div>
                <div class="meter"><i style="width:${clamp(Math.round((h.score / 4) * 100), 8, 100)}%"></i></div>
                ${made ? `<button class="btn sm" data-act="edit" data-id="${made.id}">Open short</button>` : `<button class="btn sm primary" data-act="make-hl" data-i="${i}">✂️ Make short</button>`}
              </div>
            </div>`;
          }).join('') : '<p class="muted">No big moments found. Scrub the video and use “Clip from here”.</p>'}` : ''}
      </main>`;
    const player = $('#player');
    try { player.src = await sourceUrl(s.id); } catch (e) { toast(e.message); }
    const heat = $('#heat');
    if (heat) {
      const drawHeat = () => drawHeatStrip(heat, s, player.currentTime);
      drawHeat();
      player.addEventListener('timeupdate', drawHeat);
      heat.addEventListener('click', (e) => {
        const r = heat.getBoundingClientRect();
        player.currentTime = ((e.clientX - r.left) / r.width) * s.duration;
      });
      window.addEventListener('resize', drawHeat, { once: true });
    }
  }

  function heatColor(v) {
    // v in ~[-1, 4] → dark purple … pink … yellow
    const x = clamp((v + 0.5) / 4, 0, 1);
    const stops = [[30, 20, 50], [120, 30, 120], [255, 62, 165], [255, 210, 63]];
    const f = x * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), r = f - i;
    const c = stops[i].map((a, j) => Math.round(a + (stops[i + 1][j] - a) * r));
    return `rgb(${c})`;
  }

  // Heat value at time t, or null past the scanned part.
  function curveAt(s, t) {
    const span = s.scanned || s.duration, n = s.curve.length;
    if (!n || t > span) return null;
    return s.curve[clamp(Math.floor((t / span) * n), 0, n - 1)] || 0;
  }

  function drawHeatStrip(canvas, s, current, range) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w) return;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const [a, b] = range || [0, s.duration];
    const n = s.curve.length;
    const bins = Math.min(w, 300);
    for (let i = 0; i < bins; i++) {
      const t = a + ((i + 0.5) / bins) * (b - a);
      const cv = curveAt(s, t);
      if (cv == null) { ctx.fillStyle = '#1d1d28'; ctx.fillRect((i / bins) * w, h - 3, w / bins + 0.5, 3); continue; }
      const v = cv;
      ctx.fillStyle = heatColor(v);
      const bh = clamp(((v + 1) / 5) * h, 3, h);
      ctx.fillRect((i / bins) * w, h - bh, w / bins + 0.5, bh);
    }
    for (const hl of s.highlights) {
      if (hl.peak < a || hl.peak > b) continue;
      const x = ((hl.peak - a) / (b - a)) * w;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(x - 4, 0); ctx.lineTo(x + 4, 0); ctx.lineTo(x, 6); ctx.fill();
    }
    if (current != null && !range) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(((current - a) / (b - a)) * w - 1, 0, 2, h);
    }
  }

  function newClip(s, start, end, peak, highlight) {
    const tpl = settings.template;
    const c = {
      id: uid(), sourceId: s.id, highlightId: highlight ? highlight.id : null,
      name: `${s.name} @ ${fmt(peak ?? start)}`, createdAt: Date.now(),
      in: start, out: end, peak: peak ?? null, speed: tpl.speed || 1,
      frame: structuredClone(tpl.frame),
      text: { ...structuredClone(tpl.text), hook: tpl.autoHook ? suggestHook(highlight && highlight.tags) : '', payoff: '', handle: settings.handle },
      fx: structuredClone(tpl.fx),
      captions: [],
      post: { title: '', description: '' },
      thumb: highlight ? highlight.thumb : s.thumb,
      exported: null,
    };
    c.post.title = suggestTitle(c);
    c.post.description = suggestDescription(c);
    return c;
  }

  // ---------- clips list ----------
  function renderClips() {
    const list = [...clips].sort((a, b) => b.createdAt - a.createdAt);
    const pending = list.filter((c) => !c.exported).length;
    app.innerHTML = `
      <header class="bar"><h1>Your Shorts<small>${list.length} made · ${list.length - pending} exported</small></h1></header>
      <main class="wrap">
        ${pending > 1 ? `<button class="btn primary block" data-act="export-all">🎬 Export all ${pending} unexported</button>` : ''}
        ${list.length ? `<div class="grid">${list.map((c) => {
          const dur = Render.outputDuration(c);
          return `<div class="short" data-act="edit" data-id="${c.id}">
            <div class="short-thumb">${c.thumb ? `<img src="${c.thumb}" alt="">` : ''}<span class="hook">${esc(c.text.hook)}</span>
              <span class="dur">${fmt(dur)}</span>${c.exported ? '<span class="done">✓</span>' : ''}</div>
            <b class="small">${esc(c.post.title || c.name)}</b>
          </div>`;
        }).join('')}</div>` : `<div class="empty"><div class="big">📱</div><p>No Shorts yet.</p><p class="muted">Import gameplay, then tap <b>Make short</b> on a highlight.</p><button class="btn primary" data-act="go" data-to="library">Go to gameplay</button></div>`}
      </main>
      ${nav()}`;
  }

  // ---------- settings ----------
  function accountCard() {
    const a = Plan.account();
    if (a && a.pro && isPro()) {
      const when = a.renewsAt ? new Date(a.renewsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
      const line = a.plan === 'lifetime' ? 'Lifetime · founding member'
        : a.status === 'trialing' ? `Free trial · first charge ${when}`
        : a.cancelAtPeriodEnd ? `Cancels ${when}` : `${a.plan === 'year' ? 'Yearly' : 'Monthly'} · renews ${when}`;
      return `<div class="card plan pro"><div><b>Clip Heist Pro</b> ✓<br><span class="muted small">${esc(line)}${a.email ? '<br>' + esc(a.email) : ''}</span></div>
        ${a.plan !== 'lifetime' ? '<button class="btn sm" data-act="portal">Manage</button>' : ''}</div>`;
    }
    if (isPro()) return `<div class="card plan pro"><div><b>Clip Heist Pro</b> ✓<br><span class="muted small">Test mode</span></div></div>`;
    return `<div class="card plan"><div><b>Free plan</b><br><span class="muted small">${Plan.exportsLeft()} of ${Plan.LIMITS.exportsPerWeek} exports left this week</span><br><button class="link muted-link" data-act="restore">Already paid? Restore</button></div><button class="btn primary sm" data-act="upsell" data-r="quality">Go Pro</button></div>`;
  }

  async function renderSettings() {
    const t = settings.template;
    app.innerHTML = `
      <header class="bar"><h1>Settings</h1></header>
      <main class="wrap">
        ${accountCard()}
        <div class="card stack">
          <h2>Channel</h2>
          <label class="field">Your handle (shown on every short)<input id="s-handle" placeholder="@yourchannel" value="${esc(settings.handle)}"></label>
          <label class="field">Game or streamer you clip (used in titles)<input id="s-game" placeholder="e.g. your main game" value="${esc(settings.game || '')}"></label>
          <label class="field">Default hashtags<textarea id="s-tags" rows="2">${esc(settings.hashtags)}</textarea></label>
        </div>
        <div class="card stack">
          <h2>Highlight finder</h2>
          <label class="field">Seconds before the big moment <b id="pre-v">${settings.preRoll}s</b><input type="range" id="s-pre" min="3" max="40" value="${settings.preRoll}"></label>
          <label class="field">Seconds after <b id="post-v">${settings.postRoll}s</b><input type="range" id="s-post" min="1" max="20" value="${settings.postRoll}"></label>
          <p class="hint">Applies to new scans. The best Shorts build up to the moment, then end fast.</p>
          <label class="check"><input type="checkbox" id="s-autohook" ${t.autoHook ? 'checked' : ''}> Write a hook line for new shorts automatically</label>
        </div>
        <div class="card stack">
          <h2>Export</h2>
          <div class="field">Quality<div class="chips" data-set="quality">${['1080', '720'].map((q) => `<button class="chip ${(isPro() ? settings.quality : '720') === q ? 'on' : ''}" data-v="${q}" ${!isPro() && q === '1080' ? 'data-lock="quality"' : ''}>${!isPro() && q === '1080' ? LOCK + ' ' : ''}${q}p</button>`).join('')}</div></div>
          <div class="field">Frame rate<div class="chips" data-set="fps">${[30, 60].map((q) => `<button class="chip ${(isPro() ? settings.fps : 30) === q ? 'on' : ''}" data-v="${q}" ${!isPro() && q === 60 ? 'data-lock="quality"' : ''}>${!isPro() && q === 60 ? LOCK + ' ' : ''}${q} fps</button>`).join('')}</div></div>
          <p class="hint">Format on this device: <b>${(Render.pickMime() || 'not supported').split(';')[0]}</b>. YouTube accepts both MP4 and WebM.</p>
        </div>
        <div class="card stack">
          <h2>Storage</h2>
          <p id="usage" class="muted">Checking…</p>
          <button class="btn danger" data-act="wipe">Delete all gameplay and shorts</button>
        </div>
        ${devMode() ? `<div class="card stack dev"><h2>🧪 Developer</h2>
          <label class="check"><input type="checkbox" id="s-pro" ${isPro() ? 'checked' : ''}> Pro test mode</label>
          <button class="btn sm" data-act="reset-exports">Reset weekly exports</button></div>` : ''}
        <p class="hint center" id="about">Clip Heist runs on your device. Your videos are never uploaded.<br>Not affiliated with any game publisher, Twitch or YouTube.</p>
      </main>
      ${nav()}`;
    const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
    on('#s-handle', 'change', (e) => { let v = e.target.value.trim(); if (v && !v.startsWith('@')) v = '@' + v; settings.handle = v; e.target.value = v; saveSettings(); toast('Saved'); });
    on('#s-game', 'change', (e) => { settings.game = e.target.value.trim(); saveSettings(); toast('Saved'); });
    if ($('#s-pro')) on('#s-pro', 'change', (e) => { Plan.setPro(e.target.checked); toast(e.target.checked ? 'Pro test mode on' : 'Back to Free'); render(); });
    let taps = 0;
    on('#about', 'click', () => { if (++taps >= 5) { localStorage.setItem('clip-heist-dev', devMode() ? '0' : '1'); taps = 0; toast(devMode() ? 'Developer mode on' : 'Developer mode off'); render(); } });
    on('#s-tags', 'change', (e) => { settings.hashtags = e.target.value.trim(); saveSettings(); toast('Saved'); });
    on('#s-pre', 'input', (e) => { settings.preRoll = +e.target.value; $('#pre-v').textContent = settings.preRoll + 's'; saveSettings(); });
    on('#s-post', 'input', (e) => { settings.postRoll = +e.target.value; $('#post-v').textContent = settings.postRoll + 's'; saveSettings(); });
    on('#s-autohook', 'change', (e) => { t.autoHook = e.target.checked; saveSettings(); });
    app.querySelectorAll('.chips[data-set]').forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      if (b.dataset.lock) return upsell(b.dataset.lock);
      const key = g.dataset.set;
      settings[key] = key === 'fps' ? +b.dataset.v : b.dataset.v;
      g.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b));
      saveSettings();
    }));
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      const u = $('#usage');
      if (u) u.textContent = `Using ${fmtSize(est.usage || 0)} of about ${fmtSize(est.quota || 0)} available.`;
    }
  }

  // ---------- editor ----------
  let ed = null; // live editor state

  function teardownEditor() {
    if (!ed) return;
    cancelAnimationFrame(ed.raf);
    ed.video.pause();
    ed.video.remove();
    ed.ro && ed.ro.disconnect();
    clearTimeout(ed.saveTimer);
    saveClip(ed.clip);
    ed = null;
  }

  const TABS = [['trim', 'Trim'], ['frame', 'Frame'], ['text', 'Text'], ['caps', 'Captions'], ['fx', 'FX'], ['post', 'Post']];

  async function renderEditor() {
    const clip = clips.find((c) => c.id === view.id);
    if (!clip) return go('clips');
    const s = sources.find((x) => x.id === clip.sourceId);
    if (!s) return go('clips');
    clip.captions = clip.captions || [];
    clip.text = { ...DEFAULT_SETTINGS.template.text, ...clip.text };
    app.innerHTML = `
      <header class="bar">
        <button class="icon-btn" data-act="editor-back" aria-label="Back">${ICON.back}</button>
        <h1>Edit short<small id="ed-dur"></small></h1>
        <button class="icon-btn" data-act="del-clip" data-id="${clip.id}" aria-label="Delete">${ICON.trash}</button>
        <button class="btn primary sm" data-act="export">Export</button>
      </header>
      <main class="editor">
        <div class="stage">
          <canvas id="pv" width="540" height="960"></canvas>
          <button class="play-overlay" id="pv-play" aria-label="Play">${ICON.play}</button>
        </div>
        <div class="transport">
          <button class="icon-btn" id="tp-play" aria-label="Play">${ICON.play}</button>
          <span id="tp-time" class="mono">0:00.0</span>
          <span class="spacer"></span>
          <button class="btn sm" data-act="set-peak" title="Mark the big moment">💥 Hit here</button>
          <button class="btn sm ghost" id="guides-btn" title="Show where YouTube’s buttons cover the video">Zones</button>
        </div>
        <div class="timeline" id="tl"><canvas id="tl-c"></canvas></div>
        <div class="tabs">${TABS.map(([k, l]) => `<button class="etab ${k === 'trim' ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
        <div class="panel" id="panel"></div>
      </main>`;

    const video = document.createElement('video');
    video.playsInline = true; video.setAttribute('playsinline', ''); video.preload = 'auto';
    video.className = 'offscreen';
    document.body.appendChild(video);
    const canvas = $('#pv');
    ed = { clip, source: s, video, canvas, ctx: canvas.getContext('2d'), tab: 'trim', guides: false, raf: 0, playing: false, saveTimer: null };
    try { video.src = await sourceUrl(s.id); } catch (e) { toast(e.message); return; }
    if (!ed || ed.video !== video) return; // navigated away while loading
    try { await Analyzer.whenReady(video, clip.in); } catch (e) { toast(e.message); return; }
    if (!ed || ed.video !== video) return;
    if (!s.duration) s.duration = video.duration;
    video.addEventListener('seeked', () => { if (!ed.playing) drawPreview(); });

    ed.ro = new ResizeObserver(() => drawTimeline());
    ed.ro.observe($('#tl'));
    bindEditor();
    renderPanel();
    drawPreview();
    updateDur();
  }

  function touchClip() {
    if (!ed) return;
    clearTimeout(ed.saveTimer);
    const c = ed.clip;
    ed.saveTimer = setTimeout(() => saveClip(c), 400);
    if (c.exported) { c.exported.stale = true; }
    updateDur();
    if (!ed.playing) drawPreview();
  }

  function updateDur() {
    const el = $('#ed-dur');
    if (!el || !ed) return;
    const d = Render.outputDuration(ed.clip);
    el.innerHTML = `${fmt(d, true)} long${d > 180 ? ' · <span class="bad">over 3:00 — too long for Shorts</span>' : d > 60 ? ' · <span class="warn">over 60s</span>' : ''}`;
  }

  function drawPreview() {
    if (!ed) return;
    const { ctx, canvas, video, clip } = ed;
    Render.draw(ctx, canvas.width, canvas.height, video, clip, video.currentTime, { guides: ed.guides, watermark: !isPro() });
    if (ed.tab === 'frame' && clip.frame.layout === 'stream' && !ed.playing) drawCamPicker();
    if (ed.tab === 'caps' && !ed.playing) { const b = document.querySelector('[data-act="cap-add"]'); if (b) b.textContent = '＋ Caption at ' + fmt(video.currentTime - clip.in, true); }
    const tt = $('#tp-time');
    if (tt) tt.textContent = `${fmt(video.currentTime - clip.in, true)} / ${fmt(clip.out - clip.in, true)}`;
    drawTimeline();
  }

  function setPlaying(on) {
    if (!ed) return;
    const { video, clip } = ed;
    ed.playing = on;
    $('#tp-play').innerHTML = on ? ICON.pause : ICON.play;
    $('#pv-play').style.display = on ? 'none' : '';
    if (on) {
      Render.getAudioCtx(); // unlock audio for export later
      if (video.currentTime < clip.in || video.currentTime >= clip.out - 0.05) video.currentTime = clip.in;
      video.play().catch(() => setPlaying(false));
      const loop = () => {
        if (!ed || !ed.playing) return;
        const t = video.currentTime;
        if (t >= ed.clip.out || video.ended) { video.currentTime = ed.clip.in; }
        const r = Render.speedAt(ed.clip, t);
        if (Math.abs(video.playbackRate - r) > 0.001) video.playbackRate = r;
        drawPreview();
        ed.raf = requestAnimationFrame(loop);
      };
      ed.raf = requestAnimationFrame(loop);
    } else {
      video.pause();
      cancelAnimationFrame(ed.raf);
      drawPreview();
    }
  }

  // Timeline shows the clip plus some room either side.
  function tlRange() {
    const { clip, source } = ed;
    const len = clip.out - clip.in;
    const pad = Math.max(8, len * 0.5);
    return [Math.max(0, clip.in - pad), Math.min(source.duration || clip.out + pad, clip.out + pad)];
  }

  function drawTimeline() {
    if (!ed) return;
    const c = $('#tl-c');
    if (!c) return;
    const { clip, source, video } = ed;
    const [a, b] = tlRange();
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w) return;
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const X = (t) => ((t - a) / (b - a)) * w;
    ctx.fillStyle = '#15151d';
    ctx.fillRect(0, 0, w, h);
    // heat
    if (source.curve && source.curve.length) {
      const n = source.curve.length;
      for (let x = 0; x < w; x += 3) {
        const t = a + (x / w) * (b - a);
        const v = curveAt(source, t);
        if (v == null) continue;
        ctx.fillStyle = heatColor(v);
        const bh = clamp(((v + 1) / 5) * (h - 16), 2, h - 16);
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x, h - 8 - bh, 2, bh);
      }
      ctx.globalAlpha = 1;
    }
    // dim outside the clip
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(0, 0, X(clip.in), h);
    ctx.fillRect(X(clip.out), 0, w - X(clip.out), h);
    // selection frame + handles
    ctx.strokeStyle = '#ff3ea5'; ctx.lineWidth = 3;
    ctx.strokeRect(X(clip.in), 1.5, X(clip.out) - X(clip.in), h - 3);
    for (const t of [clip.in, clip.out]) {
      ctx.fillStyle = '#ff3ea5';
      ctx.fillRect(X(t) - 7, 0, 14, h);
      ctx.fillStyle = '#1a0010';
      ctx.fillRect(X(t) - 1, h / 2 - 9, 2, 18);
    }
    // peak
    if (clip.peak != null && clip.peak >= a && clip.peak <= b) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('💥', X(clip.peak), 14);
      ctx.fillRect(X(clip.peak) - 1, 16, 2, h - 20);
    }
    // captions
    ctx.fillStyle = '#4fd1ff';
    for (const cap of clip.captions || []) ctx.fillRect(X(cap.start) + 1, h - 6, Math.max(2, X(cap.end) - X(cap.start) - 2), 4);
    // playhead
    ctx.fillStyle = '#fff';
    ctx.fillRect(X(video.currentTime) - 1, 0, 2, h);
  }

  function bindEditor() {
    const { video, canvas } = ed;
    const toggle = () => setPlaying(!ed.playing);
    $('#tp-play').addEventListener('click', toggle);
    $('#pv-play').addEventListener('click', toggle);
    $('#guides-btn').addEventListener('click', (e) => { ed.guides = !ed.guides; e.target.classList.toggle('on', ed.guides); drawPreview(); });

    // Drag on the preview to reframe; tap to play/pause.
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, panX: ed.clip.frame.panX, panY: ed.clip.frame.panY, moved: false };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const scale = canvas.width / canvas.clientWidth;
      const dx = (e.clientX - drag.x) * scale, dy = (e.clientY - drag.y) * scale;
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      if (!drag.moved) return;
      const f = ed.clip.frame, W = canvas.width, H = canvas.height;
      const vw = video.videoWidth || 16, vh = video.videoHeight || 9;
      const areaH = f.layout === 'stream' ? H * (1 - (f.split ?? 0.38)) : H;
      const s = (f.layout === 'fill' || f.layout === 'stream' ? Math.max(W / vw, areaH / vh) : W / vw) * f.zoom;
      const dw = vw * s, dh = vh * s;
      if (dw > W + 1) f.panX = clamp(drag.panX - dx / (dw - W), 0, 1);
      if (f.layout === 'fill' || f.layout === 'stream') { if (dh > areaH + 1) f.panY = clamp(drag.panY - dy / (dh - areaH), 0, 1); }
      else f.panY = clamp(drag.panY + dy / (H * 0.5), 0, 1);
      touchClip();
      syncFrameInputs();
    });
    const up = () => { if (drag && !drag.moved) toggle(); drag = null; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', () => { drag = null; });

    // Timeline: drag handles, or scrub.
    const tl = $('#tl-c');
    let tdrag = null;
    const tAt = (e) => { const r = tl.getBoundingClientRect(); const [a, b] = tlRange(); return a + clamp((e.clientX - r.left) / r.width, 0, 1) * (b - a); };
    tl.addEventListener('pointerdown', (e) => {
      tl.setPointerCapture(e.pointerId);
      const r = tl.getBoundingClientRect();
      const [a, b] = tlRange();
      const X = (t) => ((t - a) / (b - a)) * r.width + r.left;
      const dIn = Math.abs(e.clientX - X(ed.clip.in)), dOut = Math.abs(e.clientX - X(ed.clip.out));
      const range = tlRange(); // freeze range while dragging so the handle doesn't run away
      if (Math.min(dIn, dOut) < 22) tdrag = { which: dIn <= dOut ? 'in' : 'out', range };
      else tdrag = { which: 'scrub', range };
      if (ed.playing && tdrag.which !== 'scrub') setPlaying(false);
      move(e);
    });
    const move = (e) => {
      if (!tdrag) return;
      const r = tl.getBoundingClientRect();
      const [a, b] = tdrag.range;
      const t = a + clamp((e.clientX - r.left) / r.width, 0, 1) * (b - a);
      const c = ed.clip;
      if (tdrag.which === 'in') { c.in = clamp(t, 0, c.out - 1); video.currentTime = c.in; touchClip(); syncTrimInputs(); }
      else if (tdrag.which === 'out') { c.out = clamp(t, c.in + 1, ed.source.duration); video.currentTime = Math.max(c.in, c.out - 0.05); touchClip(); syncTrimInputs(); }
      else { video.currentTime = t; if (!ed.playing) drawPreview(); }
    };
    tl.addEventListener('pointermove', move);
    tl.addEventListener('pointerup', () => { tdrag = null; drawTimeline(); });
    void tAt;

    app.querySelector('.tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.etab'); if (!b) return;
      ed.tab = b.dataset.tab;
      app.querySelectorAll('.etab').forEach((x) => x.classList.toggle('on', x === b));
      renderPanel();
    });
  }

  // locked: { value: upsellReason } for options that need Pro.
  function chips(key, options, current, locked = {}) {
    return `<div class="chips" data-key="${key}">${options.map(([v, l]) => {
      const lock = !isPro() && locked[v];
      return `<button class="chip ${String(current) === String(v) ? 'on' : ''}" data-v="${v}" ${lock ? `data-lock="${lock}"` : ''}>${lock ? LOCK + ' ' : ''}${l}</button>`;
    }).join('')}</div>`;
  }
  const lockedRow = (reason, label, hint = '') => `<button class="check locked-row" data-act="upsell" data-r="${reason}"><span class="lk">${LOCK}</span><span>${label}${hint ? `<small>${hint}</small>` : ''}</span><span class="pro-tag">PRO</span></button>`;
  const styleLocks = () => Object.fromEntries(Object.keys(Render.STYLES).filter((k) => !Plan.LIMITS.freeStyles.includes(k)).map((k) => [k, 'styles']));
  const toggleRow = (key, label, on, hint = '') => `<label class="check"><input type="checkbox" data-key="${key}" ${on ? 'checked' : ''}><span>${label}${hint ? `<small>${hint}</small>` : ''}</span></label>`;

  // Keep the facecam box the chosen shape and inside the video.
  function fixCam() {
    const f = ed.clip.frame, v = ed.video, cam = f.cam;
    const vw = v.videoWidth || 16, vh = v.videoHeight || 9;
    const shape = +(f.camShape || 1.778);
    cam.w = clamp(cam.w, 0.05, 1);
    cam.h = clamp((cam.w * vw) / shape / vh, 0.05, 1);
    if (cam.h >= 1) cam.w = (vh * shape) / vw;
    cam.x = clamp(cam.x, 0, 1 - cam.w);
    cam.y = clamp(cam.y, 0, 1 - cam.h);
  }

  function drawCamPicker() {
    const c = document.getElementById('campick');
    if (!c || !ed || ed.clip.frame.layout !== 'stream') return;
    const v = ed.video, cam = ed.clip.frame.cam;
    const w = c.clientWidth, h = Math.round(w * ((v.videoHeight || 9) / (v.videoWidth || 16)));
    const dpr = window.devicePixelRatio || 1;
    c.style.height = h + 'px';
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    if (v.readyState >= 2) ctx.drawImage(v, 0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    const x = cam.x * w, y = cam.y * h, bw = cam.w * w, bh = cam.h * h;
    ctx.fillRect(0, 0, w, y); ctx.fillRect(0, y + bh, w, h - y - bh); ctx.fillRect(0, y, x, bh); ctx.fillRect(x + bw, y, w - x - bw, bh);
    ctx.strokeStyle = '#ff3ea5'; ctx.lineWidth = 3; ctx.strokeRect(x, y, bw, bh);
    ctx.fillStyle = '#ff3ea5'; ctx.font = '700 12px system-ui'; ctx.fillText('FACECAM', x + 6, y + 16);
  }

  function setupCamPicker() {
    const c = document.getElementById('campick');
    if (!c) return;
    let drag = null;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      const r = c.getBoundingClientRect(), cam = ed.clip.frame.cam;
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      // Tap outside the box moves it there; drag inside moves it along.
      if (px < cam.x || px > cam.x + cam.w || py < cam.y || py > cam.y + cam.h) { cam.x = px - cam.w / 2; cam.y = py - cam.h / 2; fixCam(); }
      drag = { px, py, x: cam.x, y: cam.y };
      drawCamPicker(); touchClip();
    });
    c.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const r = c.getBoundingClientRect(), cam = ed.clip.frame.cam;
      cam.x = drag.x + (e.clientX - r.left) / r.width - drag.px;
      cam.y = drag.y + (e.clientY - r.top) / r.height - drag.py;
      fixCam(); drawCamPicker(); touchClip();
    });
    c.addEventListener('pointerup', () => { drag = null; });
    requestAnimationFrame(drawCamPicker);
  }

  function renderPanel() {
    const c = ed.clip;
    const p = $('#panel');
    if (ed.tab === 'trim') {
      p.innerHTML = `
        <div class="trim-row">
          <div><span class="muted small">Start</span><b class="mono" id="t-in">${fmt(c.in, true)}</b></div>
          <div><span class="muted small">End</span><b class="mono" id="t-out">${fmt(c.out, true)}</b></div>
          <div><span class="muted small">Length</span><b class="mono" id="t-len">${fmt(c.out - c.in, true)}</b></div>
        </div>
        <div class="row gap">
          <button class="btn sm" data-act="nudge" data-w="in" data-d="-0.5">−½s</button>
          <button class="btn sm" data-act="set-in">⟦ Start here</button>
          <button class="btn sm" data-act="nudge" data-w="in" data-d="0.5">+½s</button>
        </div>
        <div class="row gap">
          <button class="btn sm" data-act="nudge" data-w="out" data-d="-0.5">−½s</button>
          <button class="btn sm" data-act="set-out">End here ⟧</button>
          <button class="btn sm" data-act="nudge" data-w="out" data-d="0.5">+½s</button>
        </div>
        <p class="hint">Drag the pink handles on the timeline. Tip: start 1–2 seconds before things kick off and end right after the payoff. Short + loopable = more views.</p>`;
    } else if (ed.tab === 'frame') {
      p.innerHTML = `
        <div class="field">Layout${chips('frame.layout', [['fill', 'Full screen'], ['blur', 'Fit + blur'], ['fit', 'Fit + black'], ['stream', '🎥 Streamer']], c.frame.layout, { stream: 'stream' })}</div>
        ${c.frame.layout === 'stream' ? `
          <div class="field">Facecam: drag the pink box over the streamer’s camera
            <canvas id="campick" class="campick"></canvas>
            <div class="chips">${[['tl', '↖ Top left'], ['tr', 'Top right ↗'], ['bl', '↙ Bottom left'], ['br', 'Bottom right ↘']].map(([k, l]) => `<button class="chip" data-act="cam-corner" data-c="${k}">${l}</button>`).join('')}</div>
          </div>
          <label class="field">Facecam size<input type="range" data-key="frame.cam.w" min="0.1" max="0.6" step="0.005" value="${c.frame.cam.w}"></label>
          <div class="field">Facecam shape${chips('frame.camShape', [['1.778', '16:9'], ['1.333', '4:3'], ['1', 'Square']], c.frame.camShape || '1.778')}</div>
          <label class="field">Facecam height on screen<input type="range" data-key="frame.split" min="0.25" max="0.55" step="0.005" value="${c.frame.split}"></label>` : ''}
        <label class="field">Zoom <b id="zoom-v">${c.frame.zoom.toFixed(2)}×</b><input type="range" data-key="frame.zoom" min="1" max="2.5" step="0.01" value="${c.frame.zoom}"></label>
        <label class="field">Left ↔ right<input type="range" data-key="frame.panX" min="0" max="1" step="0.005" value="${c.frame.panX}"></label>
        <label class="field">Up ↕ down<input type="range" data-key="frame.panY" min="0" max="1" step="0.005" value="${c.frame.panY}"></label>
        <p class="hint">Or just drag the video in the preview to follow the action.</p>`;
      if (c.frame.layout === 'stream') setupCamPicker();
    } else if (ed.tab === 'text') {
      const styles = Object.entries(Render.STYLES).map(([k, v]) => [k, v.label]);
      p.innerHTML = `
        <label class="field">Hook (top text)<div class="row gap"><input data-key="text.hook" value="${esc(c.text.hook)}" placeholder="WAIT FOR IT…"><button class="btn sm" data-act="reroll-hook" title="New idea">🎲</button></div></label>
        <div class="field">Style${chips('text.style', styles, c.text.style, styleLocks())}</div>
        <label class="field">Size<input type="range" data-key="text.size" min="50" max="140" value="${c.text.size}"></label>
        <label class="field">Position<input type="range" data-key="text.y" min="0.06" max="0.8" step="0.01" value="${c.text.y}"></label>
        ${isPro() ? `<label class="field">Reaction (appears at the 💥 hit)<div class="row gap"><input data-key="text.payoff" value="${esc(c.text.payoff)}" placeholder="💀💀💀"><button class="btn sm" data-act="reroll-payoff" title="New idea">🎲</button></div></label>
        <div class="field">Reaction style${chips('text.payoffStyle', styles, c.text.payoffStyle)}</div>` : lockedRow('payoff', 'Reaction text at the 💥 hit', 'e.g. “NAH 😭” the moment it happens')}
        <label class="field">Handle<input data-key="text.handle" value="${esc(c.text.handle)}" placeholder="@yourchannel"></label>`;
    } else if (ed.tab === 'caps' && !isPro()) {
      p.innerHTML = `<div class="locked-panel">
        <div class="pro-badge">PRO</div>
        <h3>Captions that keep people watching</h3>
        <p class="muted">Add timed captions that pop in as the clip plays, split long lines into fast 2–3 word captions, and pick from 6 styles.</p>
        <button class="btn primary" data-act="upsell" data-r="captions">Unlock captions</button></div>`;
    } else if (ed.tab === 'caps') {
      const styles = Object.entries(Render.STYLES).map(([k, v]) => [k, v.label]);
      const rel = (t) => fmt(t - c.in, true);
      const list = [...c.captions].sort((a, b) => a.start - b.start);
      p.innerHTML = `
        <button class="btn primary block" data-act="cap-add">＋ Caption at ${rel(ed.video.currentTime)}</button>
        <p class="hint">Play the short, pause when someone talks or something happens, tap <b>＋ Caption</b> and type. Blue bars on the timeline show your captions.</p>
        ${list.length ? list.map((cap) => `
          <div class="cap ${ed.video.currentTime >= cap.start && ed.video.currentTime < cap.end ? 'live' : ''}">
            <div class="cap-top">
              <button class="link mono" data-act="cap-play" data-id="${cap.id}">▶ ${rel(cap.start)}–${rel(cap.end)}</button>
              <span class="spacer"></span>
              <button class="btn sm ghost" data-act="cap-split" data-id="${cap.id}" title="Split into quick 2–3 word captions">✂️ Split</button>
              <button class="icon-btn" data-act="cap-del" data-id="${cap.id}" aria-label="Delete caption">${ICON.trash}</button>
            </div>
            <input class="cap-text" data-cap="${cap.id}" value="${esc(cap.text)}" placeholder="What’s happening / being said…">
            <div class="row gap">
              <button class="btn sm" data-act="cap-start" data-id="${cap.id}">⟦ Start here</button>
              <button class="btn sm" data-act="cap-end" data-id="${cap.id}">End here ⟧</button>
            </div>
          </div>`).join('') : ''}
        <div class="field">Caption style${chips('text.capStyle', styles, c.text.capStyle)}</div>
        <label class="field">Size<input type="range" data-key="text.capSize" min="40" max="120" value="${c.text.capSize}"></label>
        <label class="field">Position<input type="range" data-key="text.capY" min="0.1" max="0.85" step="0.01" value="${c.text.capY}"></label>
        ${toggleRow('text.capPop', 'Pop-in animation', c.text.capPop)}
        ${toggleRow('text.capUpper', 'ALL CAPS', c.text.capUpper)}`;
      if (ed.focusCap) { const el = p.querySelector(`[data-cap="${ed.focusCap}"]`); ed.focusCap = null; if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); } }
    } else if (ed.tab === 'fx') {
      p.innerHTML = `
        <div class="field">Speed${chips('speed', [[0.5, '0.5×'], [0.75, '0.75×'], [1, '1×'], [1.25, '1.25×'], [1.5, '1.5×'], [2, '2×']], c.speed, { 0.5: 'fx', 0.75: 'fx', 1.25: 'fx', 1.5: 'fx', 2: 'fx' })}</div>
        <p class="hint">${c.peak == null ? '⚠️ Set the 💥 hit (play to the big moment, tap “Hit here”) to use the effects below.' : `💥 Hit at ${fmt(c.peak, true)}. Effects fire there.`}</p>
        ${toggleRow('fx.punch', 'Punch-in zoom', c.fx.punch, 'Quick zoom on the hit')}
        ${isPro() ? `${toggleRow('fx.slowmo', 'Slow-mo on the hit', c.fx.slowmo, 'Drops to 40% speed for 2 seconds')}
        ${toggleRow('fx.shake', 'Camera shake', c.fx.shake)}
        ${toggleRow('fx.flash', 'White flash', c.fx.flash)}` : `${lockedRow('fx', 'Slow-mo on the hit', 'Drops to 40% speed for 2 seconds')}${lockedRow('fx', 'Camera shake')}${lockedRow('fx', 'White flash')}`}
        ${toggleRow('fx.progress', 'Progress bar', c.fx.progress, 'Keeps people watching to the end')}
        <button class="btn block ghost" data-act="save-template">${isPro() ? '' : LOCK + ' '}Use this look for all new shorts</button>`;
    } else if (ed.tab === 'post') {
      p.innerHTML = `
        <label class="field">Title <span class="muted small" id="title-n">${c.post.title.length}/100</span>
          <div class="row gap"><input data-key="post.title" maxlength="100" value="${esc(c.post.title)}"><button class="btn sm" data-act="reroll-title">🎲</button></div></label>
        <label class="field">Description<textarea data-key="post.description" rows="5">${esc(c.post.description)}</textarea></label>
        <div class="row gap"><button class="btn sm" data-act="copy-title">Copy title</button><button class="btn sm" data-act="copy-desc">Copy description</button><button class="btn sm" data-act="reset-desc">Regenerate</button></div>
        <div class="card tips">
          <b>Posting checklist</b>
          <ul>
            <li>Export, then Share → YouTube (or save to Photos and upload from the YouTube app).</li>
            <li>Under 60s gets the most replays; Shorts can be up to 3 min.</li>
            <li>Keep the first second loud — the hook decides the swipe.</li>
            <li>Keep “#shorts” in the title or description.</li>
          </ul>
        </div>`;
    }
  }

  function getKey(obj, path) { return path.split('.').reduce((o, k) => o[k], obj); }
  function setKey(obj, path, v) { const ks = path.split('.'); const last = ks.pop(); ks.reduce((o, k) => o[k], obj)[last] = v; }

  function syncTrimInputs() {
    const c = ed.clip;
    const s = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    s('#t-in', fmt(c.in, true)); s('#t-out', fmt(c.out, true)); s('#t-len', fmt(c.out - c.in, true));
  }
  function syncFrameInputs() {
    for (const k of ['frame.panX', 'frame.panY']) { const el = document.querySelector(`input[data-key="${k}"]`); if (el) el.value = getKey(ed.clip, k); }
  }

  // Panel inputs (delegated).
  app.addEventListener('input', (e) => {
    if (!ed) return;
    const el = e.target.closest('[data-key]');
    if (!el || !el.closest('#panel')) return;
    const key = el.dataset.key;
    let v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
    setKey(ed.clip, key, v);
    if (key === 'frame.zoom') $('#zoom-v').textContent = v.toFixed(2) + '×';
    if (key === 'frame.cam.w') { const cam = ed.clip.frame.cam, cx = cam.x + cam.w / 2, cy = cam.y + cam.h / 2; fixCam(); cam.x = cx - cam.w / 2; cam.y = cy - cam.h / 2; fixCam(); drawCamPicker(); }
    if (key === 'post.title') $('#title-n').textContent = v.length + '/100';
    touchClip();
  });
  app.addEventListener('input', (e) => {
    if (!ed) return;
    const el = e.target.closest('[data-cap]');
    if (!el) return;
    const cap = ed.clip.captions.find((x) => x.id === el.dataset.cap);
    if (cap) { cap.text = el.value; touchClip(); }
  });
  app.addEventListener('change', (e) => {
    if (!ed) return;
    const el = e.target.closest('input[type=checkbox][data-key]');
    if (el) { setKey(ed.clip, el.dataset.key, el.checked); touchClip(); }
  });

  // ---------- export ----------
  async function exportClips(list) {
    if (exporting) return;
    if (!list.length) return;
    if (!isPro()) {
      if (list.length > 1) return upsell('batch');
      const used = proFeaturesUsed(list[0]);
      if (used.length) return upsell('features', ` It uses: ${used.join(', ')}. Turn ${used.length > 1 ? 'them' : 'it'} off, or go Pro.`);
      if (Render.outputDuration(list[0]) > Plan.LIMITS.maxShortSeconds + 0.5) return upsell('long');
      if (Plan.exportsLeft() <= 0) {
        const at = Plan.nextExportAt();
        return upsell('exports', at ? ` Your next free export unlocks ${new Date(at).toLocaleDateString(undefined, { weekday: 'long' })}.` : '');
      }
    }
    const exportSettings = isPro() ? { ...settings } : { ...settings, quality: '720', fps: 30, watermark: true, endCard: true };
    exporting = true;
    Render.getAudioCtx(); // must happen inside the tap
    const ctrl = new AbortController();
    let wakeLock = null;
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
    const m = modal(`
      <h2 id="ex-h">Exporting…</h2>
      <p class="muted small" id="ex-sub">Your phone records the short as it plays, so this takes about ${Math.round(list.reduce((s, c) => s + Render.outputDuration(c), 0))} seconds. Keep the app open and the screen on.</p>
      <div class="progress big"><i id="ex-bar" style="width:0%"></i></div>
      <p class="mono center" id="ex-pct">0%</p>
      <button class="btn ghost block" id="ex-cancel">Cancel</button>`);
    $('#ex-cancel', m.el).addEventListener('click', () => ctrl.abort());
    const results = [];
    try {
      for (let i = 0; i < list.length; i++) {
        const clip = list[i];
        $('#ex-h', m.el).textContent = list.length > 1 ? `Exporting ${i + 1} of ${list.length}…` : 'Exporting…';
        const blob = await DB.get('blobs', 'src:' + clip.sourceId);
        const out = await Render.exportClip(clip, blob, exportSettings, (p) => {
          const total = (i + p) / list.length;
          $('#ex-bar', m.el).style.width = Math.round(total * 100) + '%';
          $('#ex-pct', m.el).textContent = Math.round(total * 100) + '%';
        }, ctrl.signal);
        await DB.put('blobs', out, 'out:' + clip.id);
        clip.exported = { type: out.type, size: out.size, at: Date.now(), stale: false };
        if (!isPro()) Plan.recordExport();
        await saveClip(clip);
        results.push(clip);
      }
      m.close();
      if (results.length === 1) showResult(results[0]);
      else { toast(`${results.length} shorts exported`); if (view.name === 'clips') render(); }
    } catch (e) {
      m.close();
      if (e.name === 'AbortError') toast('Export cancelled');
      else { console.error(e); toast('Export failed: ' + (e.message || e)); }
      if (results.length && view.name === 'clips') render();
    } finally {
      exporting = false;
      try { wakeLock && wakeLock.release(); } catch {}
    }
  }

  function fileName(clip, type) {
    const base = (clip.post.title || clip.name).replace(/#\w+/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 50) || 'short';
    return `${base}.${type.includes('mp4') ? 'mp4' : 'webm'}`;
  }

  async function showResult(clip) {
    const blob = await DB.get('blobs', 'out:' + clip.id);
    if (!blob) return toast('Export not found — export again');
    const url = URL.createObjectURL(blob);
    const file = new File([blob], fileName(clip, blob.type), { type: blob.type });
    const canShare = navigator.canShare && navigator.canShare({ files: [file] });
    const m = modal(`
      <h2>Your short is ready 🔥</h2>
      <video class="result" src="${url}" controls playsinline loop autoplay></video>
      <p class="muted small center">${fmtSize(blob.size)} · ${blob.type.split('/')[1].toUpperCase()}${clip.exported && clip.exported.stale ? ' · <span class="warn">edited since export</span>' : ''}</p>
      ${canShare ? '<button class="btn primary block" data-r="share">Share → YouTube</button>' : ''}
      <a class="btn ${canShare ? '' : 'primary'} block" href="${url}" download="${esc(file.name)}">Save video</a>
      <button class="btn block" data-r="copy">Copy title + description</button>
      ${isPro() ? '' : `<button class="btn block pro-cta" data-r="pro">✨ Remove watermark &amp; export in 1080p</button><p class="muted small center">${Plan.exportsLeft()} free export${Plan.exportsLeft() === 1 ? '' : 's'} left this week</p>`}
      <button class="btn ghost block" data-r="close">Close</button>`, {
      onMount(el, close) {
        el.addEventListener('click', async (e) => {
          const r = e.target.closest('[data-r]');
          if (!r) return;
          if (r.dataset.r === 'close') { close(); URL.revokeObjectURL(url); }
          if (r.dataset.r === 'pro') { close(); URL.revokeObjectURL(url); return upsell('watermark'); }
          if (r.dataset.r === 'copy') copy(`${clip.post.title}\n\n${clip.post.description}`);
          if (r.dataset.r === 'share') {
            try {
              // Copy the text first so it's ready to paste in the YouTube upload screen.
              navigator.clipboard?.writeText(clip.post.title).catch(() => {});
              await navigator.share({ files: [file], title: clip.post.title, text: clip.post.description });
            } catch (err) { if (err.name !== 'AbortError') toast('Sharing failed — use Save video instead'); }
          }
        });
      },
    });
    void m;
  }

  // ---------- actions ----------
  app.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const s = view.name === 'source' ? sources.find((x) => x.id === view.id) : null;
    const player = $('#player');

    switch (act) {
      case 'go': return go(el.dataset.to);
      case 'upsell': return upsell(el.dataset.r);
      case 'restore': return restoreModal();
      case 'portal': return openPortal();
      case 'reset-exports': Plan.resetExports(); toast('Exports reset'); return render();
      case 'open-source': return go('source', { id: el.dataset.id });
      case 'edit': return go('editor', { id: el.dataset.id });
      case 'editor-back': { const c = ed && ed.clip; return go(c ? 'source' : 'clips', c ? { id: c.sourceId } : {}); }

      case 'del-source': {
        const src = sources.find((x) => x.id === el.dataset.id);
        const n = clips.filter((c) => c.sourceId === src.id).length;
        if (!(await confirmBox('Delete this gameplay?', n ? `This also deletes the ${n} short${n > 1 ? 's' : ''} made from it.` : 'The video will be removed from this app.'))) return;
        for (const c of clips.filter((c) => c.sourceId === src.id)) { await DB.del('clips', c.id); await DB.del('blobs', 'out:' + c.id); }
        clips = clips.filter((c) => c.sourceId !== src.id);
        await DB.del('sources', src.id); await DB.del('blobs', 'src:' + src.id);
        sources = sources.filter((x) => x.id !== src.id);
        if (objectUrls.has(src.id)) { URL.revokeObjectURL(objectUrls.get(src.id)); objectUrls.delete(src.id); }
        toast('Deleted');
        return go('library');
      }
      case 'rescan': s.scanAttempts = 0; scanQueue.push(s.id); s.status = 'scanning'; render(); return runScans();
      case 'preview-hl': {
        const h = s.highlights[+el.dataset.i];
        player.currentTime = h.start; player.play().catch(() => {});
        player.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      case 'make-hl': {
        const h = s.highlights[+el.dataset.i];
        const c = newClip(s, h.start, h.end, h.peak, h);
        clips.push(c); await saveClip(c);
        return go('editor', { id: c.id });
      }
      case 'clip-here': {
        if (!isPro() && (player.currentTime || 0) > Plan.LIMITS.maxSourceSeconds) return upsell('length');
        if (!s.duration && player.duration) s.duration = player.duration;
        const t = player.currentTime || 0;
        const c = newClip(s, Math.max(0, t - settings.preRoll), Math.min(s.duration || t + settings.postRoll, t + settings.postRoll), t, null);
        c.thumb = s.thumb;
        clips.push(c); await saveClip(c);
        return go('editor', { id: c.id });
      }
      case 'auto-all': {
        if (!isPro()) return upsell('batch');
        let n = 0;
        for (const h of s.highlights) {
          if (clips.some((c) => c.highlightId === h.id)) continue;
          const c = newClip(s, h.start, h.end, h.peak, h);
          clips.push(c); await saveClip(c); n++;
        }
        toast(n ? `Made ${n} shorts — review and export them` : 'All highlights already have shorts');
        return go('clips');
      }
      case 'export-all': if (!isPro()) return upsell('batch'); return exportClips(clips.filter((c) => !c.exported));

      case 'del-clip': {
        if (!(await confirmBox('Delete this short?', 'Your gameplay stays; only this edit is removed.'))) return;
        const id = el.dataset.id;
        const src = ed && ed.clip.sourceId;
        teardownEditor();
        clips = clips.filter((c) => c.id !== id);
        await DB.del('clips', id); await DB.del('blobs', 'out:' + id);
        return go(src ? 'source' : 'clips', src ? { id: src } : {});
      }
      case 'wipe': {
        if (!(await confirmBox('Delete everything?', 'All imported gameplay and shorts will be removed from this phone.'))) return;
        for (const st of ['sources', 'clips', 'blobs']) await DB.clear(st);
        sources = []; clips = [];
        objectUrls.forEach((u) => URL.revokeObjectURL(u)); objectUrls.clear();
        toast('All cleared');
        return render();
      }
    }

    if (!ed) return;
    const c = ed.clip, v = ed.video;
    switch (act) {
      case 'export':
        setPlaying(false);
        await saveClip(c);
        if (c.exported && !c.exported.stale) return showResult(c);
        return exportClips([c]);
      case 'set-peak': c.peak = v.currentTime; touchClip(); if (ed.tab === 'fx') renderPanel(); return toast('💥 Hit marked at ' + fmt(c.peak, true));
      case 'set-in': c.in = clamp(v.currentTime, 0, c.out - 1); break;
      case 'set-out': c.out = clamp(v.currentTime, c.in + 1, ed.source.duration); break;
      case 'nudge': {
        const d = +el.dataset.d;
        if (el.dataset.w === 'in') { c.in = clamp(c.in + d, 0, c.out - 1); v.currentTime = c.in; }
        else { c.out = clamp(c.out + d, c.in + 1, ed.source.duration); v.currentTime = Math.max(c.in, c.out - 1); }
        break;
      }
      case 'reroll-hook': c.text.hook = suggestHook(ed.source.highlights.find((h) => h.id === c.highlightId)?.tags); renderPanel(); break;
      case 'reroll-payoff': c.text.payoff = pick(PAYOFFS); renderPanel(); break;
      case 'reroll-title': c.post.title = suggestTitle(c); renderPanel(); break;
      case 'reset-desc': c.post.description = suggestDescription(c); renderPanel(); break;
      case 'cap-add': {
        setPlaying(false);
        const t = clamp(v.currentTime, c.in, c.out - 0.3);
        const next = c.captions.filter((x) => x.start > t + 0.05).sort((a, b) => a.start - b.start)[0];
        const end = Math.min(t + 2.5, next ? next.start : Infinity, c.out);
        // A caption already showing here ends where the new one starts.
        for (const x of c.captions) if (x.start <= t && x.end > t) x.end = t;
        c.captions = c.captions.filter((x) => x.end - x.start > 0.05);
        const cap = { id: uid(), start: t, end, text: '' };
        c.captions.push(cap);
        ed.focusCap = cap.id;
        renderPanel();
        break;
      }
      case 'cap-del': c.captions = c.captions.filter((x) => x.id !== el.dataset.id); renderPanel(); break;
      case 'cap-play': {
        const cap = c.captions.find((x) => x.id === el.dataset.id);
        if (cap) { v.currentTime = cap.start; setPlaying(true); }
        return;
      }
      case 'cap-start': case 'cap-end': {
        const cap = c.captions.find((x) => x.id === el.dataset.id);
        if (!cap) return;
        if (act === 'cap-start') cap.start = clamp(v.currentTime, c.in, cap.end - 0.2);
        else cap.end = clamp(v.currentTime, cap.start + 0.2, c.out);
        renderPanel();
        break;
      }
      case 'cap-split': {
        const cap = c.captions.find((x) => x.id === el.dataset.id);
        const words = (cap && cap.text.trim().split(/\s+/)) || [];
        if (words.length < 3) return toast('Type a longer line first, then split it');
        // Groups of 3 words; avoid a lonely last word (4 → 2 + 2).
        const fixed = [];
        for (let i = 0, n = words.length; n > 0;) {
          const size = n === 4 ? 2 : Math.min(3, n);
          fixed.push(words.slice(i, i + size).join(' '));
          i += size; n -= size;
        }
        const per = (cap.end - cap.start) / fixed.length;
        const parts = fixed.map((text, i) => ({ id: uid(), start: cap.start + i * per, end: cap.start + (i + 1) * per, text }));
        c.captions = c.captions.filter((x) => x.id !== cap.id).concat(parts);
        renderPanel();
        toast(`Split into ${parts.length} captions`);
        break;
      }
      case 'copy-title': return copy(c.post.title);
      case 'copy-desc': return copy(c.post.description);
      case 'cam-corner': {
        const cam = c.frame.cam, m = 0.01, k2 = el.dataset.c;
        cam.x = k2.includes('l') ? m : 1 - cam.w - m;
        cam.y = k2.includes('t') ? m : 1 - cam.h - m;
        fixCam(); drawCamPicker(); break;
      }
      case 'save-template':
        if (!isPro()) return upsell('template');
        settings.template = { ...settings.template, frame: structuredClone(c.frame), fx: structuredClone(c.fx), speed: c.speed,
          text: { style: c.text.style, size: c.text.size, y: c.text.y, payoffStyle: c.text.payoffStyle, payoffY: c.text.payoffY,
            capStyle: c.text.capStyle, capSize: c.text.capSize, capY: c.text.capY, capPop: c.text.capPop, capUpper: c.text.capUpper } };
        await saveSettings();
        return toast('New shorts will use this look');
      default: return;
    }
    syncTrimInputs();
    touchClip();
  });

  // Chips inside the editor panel.
  app.addEventListener('click', (e) => {
    if (!ed) return;
    const chip = e.target.closest('#panel .chips[data-key] .chip');
    if (!chip) return;
    if (chip.dataset.lock) return upsell(chip.dataset.lock);
    const group = chip.parentElement;
    const key = group.dataset.key;
    const raw = chip.dataset.v;
    setKey(ed.clip, key, key === 'speed' ? +raw : raw);
    group.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === chip));
    if (key === 'frame.layout') {
      const f = ed.clip.frame;
      f.panY = 0.5;
      if (raw === 'stream') { f.cam = f.cam || { x: 0.01, y: 0.01, w: 0.26, h: 0.26 }; f.split = f.split ?? 0.38; f.camShape = f.camShape || '1.778'; fixCam(); }
      renderPanel();
    }
    if (key === 'frame.camShape') { fixCam(); drawCamPicker(); }
    touchClip();
  });

  document.addEventListener('keydown', (e) => {
    if (!ed || e.target.matches('input, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!ed.playing); }
  });

  // ---------- boot ----------
  async function boot() {
    try {
      const saved = await DB.get('kv', 'settings');
      if (saved) settings = { ...structuredClone(DEFAULT_SETTINGS), ...saved, template: { ...structuredClone(DEFAULT_SETTINGS.template), ...(saved.template || {}) } };
      sources = (await DB.all('sources')) || [];
      clips = (await DB.all('clips')) || [];
    } catch (e) {
      console.error(e);
      toast('Storage unavailable — private browsing?');
    }
    // Resume scans that were interrupted.
    for (const s of sources) if (s.status === 'new' || s.status === 'scanning') scanQueue.push(s.id);
    const [name, id] = location.hash.slice(1).split('/');
    if (name === 'source' && sources.some((s) => s.id === id)) view = { name, id };
    else if (name === 'editor' && clips.some((c) => c.id === id)) view = { name, id };
    else if (['clips', 'settings'].includes(name)) view = { name };
    render();
    runScans();
    loadPayments();
    handleReturn();
    refreshAccount().then(() => { if (view.name === 'settings') render(); });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  boot();
})();
