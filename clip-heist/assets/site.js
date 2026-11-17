// Clip Heist website: small, dependency-free enhancements.
(() => {
  'use strict';

  // Where waitlist emails are sent. Paste a Formspree (or similar) form URL here,
  // e.g. 'https://formspree.io/f/abcdwxyz'. Until it's set, signups are not saved.
  const WAITLIST_ENDPOINT = 'https://formspree.io/f/xbgoorgo';

  document.documentElement.classList.add('js');
  const $ = (s, r = document) => r.querySelector(s);

  // Nav background once you scroll.
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 10);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile menu.
  const menuBtn = $('#menu-btn'), links = $('#links');
  menuBtn.addEventListener('click', () => {
    const open = !links.classList.contains('open');
    links.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  links.addEventListener('click', (e) => {
    if (e.target.closest('a')) { links.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
  });

  // Fade sections in as they scroll into view.
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 70}ms`; io.observe(el); });
  } else items.forEach((el) => el.classList.add('in'));

  // Pause the hero video when it's off screen (saves battery and CPU).
  const heroVideo = $('.phone video');
  if (heroVideo && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { if (e.isIntersecting) heroVideo.play().catch(() => {}); else heroVideo.pause(); }).observe(heroVideo);
  }

  // Demo video with sound.
  const dlg = $('#demo'), demoVideo = $('#demo-video');
  $('#demo-btn').addEventListener('click', () => {
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    demoVideo.currentTime = 0;
    demoVideo.play().catch(() => {});
  });
  const closeDemo = () => { demoVideo.pause(); dlg.close ? dlg.close() : dlg.removeAttribute('open'); };
  $('#demo-x').addEventListener('click', closeDemo);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDemo(); });
  dlg.addEventListener('close', () => demoVideo.pause());

  // Monthly / yearly toggle.
  document.querySelectorAll('[data-bill]').forEach((b) => b.addEventListener('click', () => {
    const period = b.dataset.bill;
    document.querySelectorAll('[data-bill]').forEach((x) => x.classList.toggle('on', x === b));
    document.querySelectorAll('[data-month]').forEach((el) => { el.textContent = el.dataset[period]; });
  }));

  // When payments are live, turn the pricing buttons into checkout buttons.
  fetch('/api/health').then((r) => (r.ok ? r.json() : null)).then((h) => {
    if (!h || !h.payments) return;
    const pro = document.querySelector('.plan.pro .btn'), founder = document.querySelector('.plan.founder .btn');
    const period = () => (document.querySelector('[data-bill].on')?.dataset.bill === 'year' ? 'year' : 'month');
    if (pro && h.prices.month) {
      pro.textContent = 'Start 7-day free trial';
      pro.href = 'app/?buy=month';
      pro.addEventListener('click', () => { pro.href = `app/?buy=${period()}`; });
    }
    if (founder && h.prices.lifetime) { founder.textContent = 'Become a founder · $79'; founder.href = 'app/?buy=lifetime'; }
    const note = document.querySelector('#pricing .fine.center');
    if (note) note.textContent = '7-day free trial on Pro. Cancel anytime in a couple of clicks.';
  }).catch(() => {});

  // Waitlist.
  const form = $('#wl-form'), msg = $('#wl-msg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    msg.className = 'wl-msg';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = 'Enter a valid email address.'; msg.classList.add('err'); form.email.focus(); return; }
    if (form._gotcha.value) return; // bot
    if (!WAITLIST_ENDPOINT) { msg.textContent = 'The waitlist opens very soon. Check back shortly!'; msg.classList.add('err'); return; }
    const btn = form.querySelector('button');
    btn.disabled = true; btn.textContent = 'Joining…';
    try {
      const res = await fetch(WAITLIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, source: 'website', page: location.pathname, _subject: 'New Clip Heist waitlist signup' }),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      msg.textContent = "You're on the list 🎉 We'll email you on launch day.";
      msg.classList.add('ok');
    } catch {
      msg.textContent = 'Something went wrong. Please try again.';
      msg.classList.add('err');
    } finally {
      btn.disabled = false; btn.textContent = 'Join the waitlist';
    }
  });
})();
